// PV-Modul Dachauslegung - Main Application

class PVLayoutCalculator {
    constructor() {
        this.canvas = document.getElementById('roofCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.scale = 0.1; // cm to pixels
        this.obstacles = [];
        this.lastLayout = null;
        this.lastParams = null;

        this.initEventListeners();
        this.calculate(); // Initial calculation
    }

    initEventListeners() {
        document.getElementById('calculateBtn').addEventListener('click', () => this.calculate());
        document.getElementById('addObstacleBtn').addEventListener('click', () => this.addObstacle());
        document.getElementById('exportPdfBtn').addEventListener('click', () => this.exportPDF());
        document.getElementById('exportCsvBtn').addEventListener('click', () => this.exportCSV());

        // Auto-recalculate on input change
        const inputs = document.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.addEventListener('change', () => this.calculate());
        });
    }

    addObstacle() {
        const obstacleId = Date.now();
        const obstacleHtml = `
            <div class="obstacle-item" data-id="${obstacleId}">
                <select class="obstacle-type">
                    <option value="skylight">Dachfenster</option>
                    <option value="vent">Lüftung</option>
                    <option value="chimney">Kamin</option>
                    <option value="antenna">Antenne</option>
                    <option value="other">Andere</option>
                </select>
                <input type="number" class="obstacle-x" placeholder="X" value="500" min="0">
                <input type="number" class="obstacle-y" placeholder="Y" value="500" min="0">
                <input type="number" class="obstacle-w" placeholder="B" value="100" min="10">
                <input type="number" class="obstacle-h" placeholder="H" value="100" min="10">
                <button type="button" class="remove-obstacle" onclick="calculator.removeObstacle(${obstacleId})">X</button>
            </div>
        `;

        document.getElementById('obstacleList').insertAdjacentHTML('beforeend', obstacleHtml);

        // Add event listeners for the new obstacle inputs
        const obstacleItem = document.querySelector(`[data-id="${obstacleId}"]`);
        obstacleItem.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('change', () => this.calculate());
        });

        this.calculate();
    }

    removeObstacle(id) {
        const element = document.querySelector(`[data-id="${id}"]`);
        if (element) {
            element.remove();
            this.calculate();
        }
    }

    getObstacles() {
        const obstacles = [];
        document.querySelectorAll('.obstacle-item').forEach(item => {
            obstacles.push({
                type: item.querySelector('.obstacle-type').value,
                x: parseFloat(item.querySelector('.obstacle-x').value) || 0,
                y: parseFloat(item.querySelector('.obstacle-y').value) || 0,
                width: parseFloat(item.querySelector('.obstacle-w').value) || 100,
                height: parseFloat(item.querySelector('.obstacle-h').value) || 100
            });
        });
        return obstacles;
    }

    getInputValues() {
        const orientation = document.getElementById('moduleOrientation').value;
        let moduleWidth = parseFloat(document.getElementById('moduleWidth').value);
        let moduleHeight = parseFloat(document.getElementById('moduleHeight').value);

        // Swap dimensions based on orientation
        if (orientation === 'landscape') {
            [moduleWidth, moduleHeight] = [moduleHeight, moduleWidth];
        }

        return {
            roofWidth: parseFloat(document.getElementById('roofWidth').value),
            roofLength: parseFloat(document.getElementById('roofLength').value),
            moduleWidth: moduleWidth,
            moduleHeight: moduleHeight,
            moduleWidthOriginal: parseFloat(document.getElementById('moduleWidth').value),
            moduleHeightOriginal: parseFloat(document.getElementById('moduleHeight').value),
            modulePower: parseFloat(document.getElementById('modulePower').value),
            edgeDistance: parseFloat(document.getElementById('edgeDistance').value),
            moduleSpacing: parseFloat(document.getElementById('moduleSpacing').value),
            walkwayWidth: parseFloat(document.getElementById('walkwayWidth').value),
            safetyType: document.getElementById('safetyType').value,
            orientation: orientation,
            tiltAngle: parseFloat(document.getElementById('tiltAngle').value),
            obstacles: this.getObstacles()
        };
    }

    calculate() {
        const params = this.getInputValues();

        // Validate inputs
        if (!this.validateInputs(params)) {
            return;
        }

        // Calculate row spacing based on tilt angle
        params.calculatedRowSpacing = this.calculateRowSpacing(params);

        // Calculate layout based on safety type
        const layout = this.calculateLayout(params);

        // Store for export
        this.lastLayout = layout;
        this.lastParams = params;

        // Update results display
        this.updateResults(layout, params);

        // Draw visualization
        this.drawLayout(layout, params);
    }

    calculateRowSpacing(params) {
        // Calculate minimum row spacing to avoid shading
        // Based on winter solstice sun angle (approximately 15-20° at noon in central Europe)
        const tiltAngleRad = (params.tiltAngle * Math.PI) / 180;
        const sunAngle = 20; // degrees - winter solstice noon sun angle
        const sunAngleRad = (sunAngle * Math.PI) / 180;

        // Shadow length calculation
        const moduleProjectedHeight = params.moduleHeight * Math.sin(tiltAngleRad);
        const shadowLength = moduleProjectedHeight / Math.tan(sunAngleRad);

        // Minimum spacing = shadow length + module ground projection
        const moduleGroundProjection = params.moduleHeight * Math.cos(tiltAngleRad);
        const minRowSpacing = shadowLength + moduleGroundProjection;

        // Use the larger of calculated spacing or user-defined spacing
        return Math.max(minRowSpacing, params.moduleSpacing);
    }

    validateInputs(params) {
        // Basic validation
        if (params.roofWidth < params.moduleWidth + 2 * params.edgeDistance) {
            alert('Dachbreite ist zu klein für die gewählten Parameter');
            return false;
        }
        if (params.roofLength < params.moduleHeight + 2 * params.edgeDistance) {
            alert('Dachlänge ist zu klein für die gewählten Parameter');
            return false;
        }
        return true;
    }

    calculateLayout(params) {
        const {
            roofWidth, roofLength,
            moduleWidth, moduleHeight,
            edgeDistance, moduleSpacing, walkwayWidth,
            safetyType, calculatedRowSpacing, obstacles
        } = params;

        // Available area after edge distance
        const availableWidth = roofWidth - 2 * edgeDistance;
        const availableLength = roofLength - 2 * edgeDistance;

        let modules = [];
        let walkways = [];
        let anchors = [];

        switch (safetyType) {
            case 'omega':
                ({ modules, walkways } = this.calculateOmegaLayout(
                    availableWidth, availableLength, edgeDistance,
                    moduleWidth, moduleHeight, moduleSpacing, calculatedRowSpacing, walkwayWidth
                ));
                break;
            case 'h':
                ({ modules, walkways } = this.calculateHLayout(
                    availableWidth, availableLength, edgeDistance,
                    moduleWidth, moduleHeight, moduleSpacing, calculatedRowSpacing, walkwayWidth
                ));
                break;
            case 'i':
                ({ modules, walkways, anchors } = this.calculateILayout(
                    availableWidth, availableLength, edgeDistance,
                    moduleWidth, moduleHeight, moduleSpacing, calculatedRowSpacing, walkwayWidth
                ));
                break;
            case 'rahmen':
                ({ modules, walkways } = this.calculateRahmenLayout(
                    availableWidth, availableLength, edgeDistance,
                    moduleWidth, moduleHeight, moduleSpacing, calculatedRowSpacing, walkwayWidth
                ));
                break;
        }

        // Remove modules that overlap with obstacles
        modules = this.removeObstacleOverlaps(modules, obstacles, params);

        // Calculate shading zones
        const shadingZones = this.calculateShadingZones(obstacles, params);

        return { modules, walkways, anchors, obstacles, shadingZones };
    }

    removeObstacleOverlaps(modules, obstacles, params) {
        if (obstacles.length === 0) return modules;

        const buffer = 50; // 50cm buffer around obstacles

        return modules.filter(module => {
            for (const obstacle of obstacles) {
                // Check if module overlaps with obstacle (including buffer)
                const obstacleLeft = obstacle.x - buffer;
                const obstacleRight = obstacle.x + obstacle.width + buffer;
                const obstacleTop = obstacle.y - buffer;
                const obstacleBottom = obstacle.y + obstacle.height + buffer;

                const moduleLeft = module.x;
                const moduleRight = module.x + module.width;
                const moduleTop = module.y;
                const moduleBottom = module.y + module.height;

                // Check for overlap
                if (moduleLeft < obstacleRight &&
                    moduleRight > obstacleLeft &&
                    moduleTop < obstacleBottom &&
                    moduleBottom > obstacleTop) {
                    return false; // Remove this module
                }
            }
            return true; // Keep this module
        });
    }

    calculateShadingZones(obstacles, params) {
        const shadingZones = [];
        const tiltAngleRad = (params.tiltAngle * Math.PI) / 180;
        const sunAngle = 20; // degrees
        const sunAngleRad = (sunAngle * Math.PI) / 180;

        obstacles.forEach(obstacle => {
            // Assume obstacles cast shadow towards south (positive Y direction)
            const shadowLength = obstacle.height / Math.tan(sunAngleRad);

            shadingZones.push({
                x: obstacle.x,
                y: obstacle.y + obstacle.height,
                width: obstacle.width,
                height: shadowLength
            });
        });

        return shadingZones;
    }

    calculateOmegaLayout(availableWidth, availableLength, edgeDistance, moduleWidth, moduleHeight, moduleSpacing, rowSpacing, walkwayWidth) {
        const modules = [];
        const walkways = [];

        // Omega form: walkway forms a rectangle in the middle
        const innerStartX = edgeDistance + availableWidth * 0.3;
        const innerEndX = edgeDistance + availableWidth * 0.7;
        const innerStartY = edgeDistance + walkwayWidth / 2;
        const innerEndY = edgeDistance + availableLength - walkwayWidth / 2;

        // Create walkway path (Omega shape - open at bottom)
        walkways.push({
            type: 'omega',
            points: [
                { x: innerStartX, y: innerEndY },
                { x: innerStartX, y: innerStartY },
                { x: innerEndX, y: innerStartY },
                { x: innerEndX, y: innerEndY }
            ],
            width: walkwayWidth
        });

        // Place modules in four quadrants
        // Left side
        this.placeModulesInArea(
            modules,
            edgeDistance, edgeDistance,
            innerStartX - walkwayWidth / 2 - edgeDistance, availableLength,
            moduleWidth, moduleHeight, moduleSpacing, rowSpacing
        );

        // Right side
        this.placeModulesInArea(
            modules,
            innerEndX + walkwayWidth / 2, edgeDistance,
            edgeDistance + availableWidth - innerEndX - walkwayWidth / 2, availableLength,
            moduleWidth, moduleHeight, moduleSpacing, rowSpacing
        );

        // Middle area
        this.placeModulesInArea(
            modules,
            innerStartX + walkwayWidth / 2, innerStartY + walkwayWidth / 2,
            innerEndX - innerStartX - walkwayWidth, availableLength - walkwayWidth,
            moduleWidth, moduleHeight, moduleSpacing, rowSpacing
        );

        return { modules, walkways };
    }

    calculateHLayout(availableWidth, availableLength, edgeDistance, moduleWidth, moduleHeight, moduleSpacing, rowSpacing, walkwayWidth) {
        const modules = [];
        const walkways = [];

        const centerX = edgeDistance + availableWidth / 2;
        const centerY = edgeDistance + availableLength / 2;

        // Vertical walkway
        walkways.push({
            type: 'line',
            start: { x: centerX, y: edgeDistance },
            end: { x: centerX, y: edgeDistance + availableLength },
            width: walkwayWidth
        });

        // Horizontal walkway
        walkways.push({
            type: 'line',
            start: { x: edgeDistance, y: centerY },
            end: { x: edgeDistance + availableWidth, y: centerY },
            width: walkwayWidth
        });

        // Place modules in four quadrants
        const quadrantWidth = availableWidth / 2 - walkwayWidth / 2;
        const quadrantHeight = availableLength / 2 - walkwayWidth / 2;

        // Top-left
        this.placeModulesInArea(modules, edgeDistance, edgeDistance, quadrantWidth, quadrantHeight, moduleWidth, moduleHeight, moduleSpacing, rowSpacing);

        // Top-right
        this.placeModulesInArea(modules, centerX + walkwayWidth / 2, edgeDistance, quadrantWidth, quadrantHeight, moduleWidth, moduleHeight, moduleSpacing, rowSpacing);

        // Bottom-left
        this.placeModulesInArea(modules, edgeDistance, centerY + walkwayWidth / 2, quadrantWidth, quadrantHeight, moduleWidth, moduleHeight, moduleSpacing, rowSpacing);

        // Bottom-right
        this.placeModulesInArea(modules, centerX + walkwayWidth / 2, centerY + walkwayWidth / 2, quadrantWidth, quadrantHeight, moduleWidth, moduleHeight, moduleSpacing, rowSpacing);

        return { modules, walkways };
    }

    calculateILayout(availableWidth, availableLength, edgeDistance, moduleWidth, moduleHeight, moduleSpacing, rowSpacing, walkwayWidth) {
        const modules = [];
        const walkways = [];
        const anchors = [];

        const centerX = edgeDistance + availableWidth / 2;

        // Vertical walkway
        walkways.push({
            type: 'line',
            start: { x: centerX, y: edgeDistance },
            end: { x: centerX, y: edgeDistance + availableLength },
            width: walkwayWidth
        });

        // Add anchor points
        const anchorSpacing = 300;
        const numAnchors = Math.floor(availableLength / anchorSpacing) + 1;
        for (let i = 0; i < numAnchors; i++) {
            anchors.push({
                x: centerX,
                y: edgeDistance + i * (availableLength / (numAnchors - 1 || 1))
            });
        }

        // Place modules on both sides
        const sideWidth = availableWidth / 2 - walkwayWidth / 2;

        // Left side
        this.placeModulesInArea(modules, edgeDistance, edgeDistance, sideWidth, availableLength, moduleWidth, moduleHeight, moduleSpacing, rowSpacing);

        // Right side
        this.placeModulesInArea(modules, centerX + walkwayWidth / 2, edgeDistance, sideWidth, availableLength, moduleWidth, moduleHeight, moduleSpacing, rowSpacing);

        return { modules, walkways, anchors };
    }

    calculateRahmenLayout(availableWidth, availableLength, edgeDistance, moduleWidth, moduleHeight, moduleSpacing, rowSpacing, walkwayWidth) {
        const modules = [];
        const walkways = [];

        // Rahmen form: rectangular frame at ~2.5m (250cm) from the roof edge
        const frameDistance = 250; // Distance from edge to safety frame

        // Calculate frame coordinates
        const frameLeft = edgeDistance + frameDistance;
        const frameRight = edgeDistance + availableWidth - frameDistance;
        const frameTop = edgeDistance + frameDistance;
        const frameBottom = edgeDistance + availableLength - frameDistance;

        // Create rectangular frame walkway (closed rectangle)
        walkways.push({
            type: 'rahmen',
            points: [
                { x: frameLeft, y: frameTop },
                { x: frameRight, y: frameTop },
                { x: frameRight, y: frameBottom },
                { x: frameLeft, y: frameBottom },
                { x: frameLeft, y: frameTop } // Close the rectangle
            ],
            width: walkwayWidth
        });

        // Place modules inside the frame
        const innerWidth = frameRight - frameLeft - walkwayWidth;
        const innerHeight = frameBottom - frameTop - walkwayWidth;

        if (innerWidth > 0 && innerHeight > 0) {
            this.placeModulesInArea(
                modules,
                frameLeft + walkwayWidth / 2,
                frameTop + walkwayWidth / 2,
                innerWidth,
                innerHeight,
                moduleWidth, moduleHeight, moduleSpacing, rowSpacing
            );
        }

        return { modules, walkways };
    }

    placeModulesInArea(modules, startX, startY, areaWidth, areaHeight, moduleWidth, moduleHeight, spacingX, spacingY) {
        if (areaWidth <= 0 || areaHeight <= 0) return;

        // Calculate how many modules fit
        const modulesPerRow = Math.floor((areaWidth + spacingX) / (moduleWidth + spacingX));
        const modulesPerCol = Math.floor((areaHeight + spacingY) / (moduleHeight + spacingY));

        if (modulesPerRow <= 0 || modulesPerCol <= 0) return;

        // Center the modules in the available area
        const totalModuleWidth = modulesPerRow * moduleWidth + (modulesPerRow - 1) * spacingX;
        const totalModuleHeight = modulesPerCol * moduleHeight + (modulesPerCol - 1) * spacingY;
        const offsetX = (areaWidth - totalModuleWidth) / 2;
        const offsetY = (areaHeight - totalModuleHeight) / 2;

        for (let row = 0; row < modulesPerCol; row++) {
            for (let col = 0; col < modulesPerRow; col++) {
                modules.push({
                    x: startX + offsetX + col * (moduleWidth + spacingX),
                    y: startY + offsetY + row * (moduleHeight + spacingY),
                    width: moduleWidth,
                    height: moduleHeight
                });
            }
        }
    }

    updateResults(layout, params) {
        const moduleCount = layout.modules.length;
        const totalPower = moduleCount * params.modulePower;
        const moduleArea = params.moduleWidth * params.moduleHeight / 10000;
        const coveredArea = moduleCount * moduleArea;
        const roofArea = (params.roofWidth * params.roofLength) / 10000;
        const areaUsage = (coveredArea / roofArea) * 100;

        // Check for shading issues
        let shadingStatus = 'OK';
        if (params.tiltAngle > 0) {
            const effectiveRowSpacing = params.calculatedRowSpacing;
            if (effectiveRowSpacing > params.moduleSpacing * 2) {
                shadingStatus = 'Prüfen';
            } else {
                shadingStatus = 'Optimal';
            }
        } else {
            shadingStatus = 'N/A';
        }

        document.getElementById('moduleCount').textContent = moduleCount;
        document.getElementById('totalPower').textContent = `${(totalPower / 1000).toFixed(2)} kWp`;
        document.getElementById('coveredArea').textContent = `${coveredArea.toFixed(1)} m²`;
        document.getElementById('areaUsage').textContent = `${areaUsage.toFixed(1)}%`;
        document.getElementById('rowSpacing').textContent = `${params.calculatedRowSpacing.toFixed(0)} cm`;
        document.getElementById('shadingStatus').textContent = shadingStatus;
    }

    drawLayout(layout, params) {
        const { roofWidth, roofLength, edgeDistance } = params;

        // Calculate scale to fit canvas
        const maxCanvasWidth = 800;
        const maxCanvasHeight = 600;
        const scaleX = maxCanvasWidth / roofWidth;
        const scaleY = maxCanvasHeight / roofLength;
        this.scale = Math.min(scaleX, scaleY, 0.5);

        // Set canvas size
        this.canvas.width = roofWidth * this.scale + 40;
        this.canvas.height = roofLength * this.scale + 40;

        const ctx = this.ctx;
        const offsetX = 20;
        const offsetY = 20;

        // Clear canvas
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw roof outline
        ctx.fillStyle = '#e0e0e0';
        ctx.fillRect(offsetX, offsetY, roofWidth * this.scale, roofLength * this.scale);

        // Draw available area
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(
            offsetX + edgeDistance * this.scale,
            offsetY + edgeDistance * this.scale,
            (roofWidth - 2 * edgeDistance) * this.scale,
            (roofLength - 2 * edgeDistance) * this.scale
        );

        // Draw shading zones
        if (layout.shadingZones) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            layout.shadingZones.forEach(zone => {
                ctx.fillRect(
                    offsetX + zone.x * this.scale,
                    offsetY + zone.y * this.scale,
                    zone.width * this.scale,
                    zone.height * this.scale
                );
            });
        }

        // Draw obstacles
        if (layout.obstacles) {
            ctx.fillStyle = '#795548';
            ctx.strokeStyle = '#5D4037';
            ctx.lineWidth = 2;
            layout.obstacles.forEach(obstacle => {
                ctx.fillRect(
                    offsetX + obstacle.x * this.scale,
                    offsetY + obstacle.y * this.scale,
                    obstacle.width * this.scale,
                    obstacle.height * this.scale
                );
                ctx.strokeRect(
                    offsetX + obstacle.x * this.scale,
                    offsetY + obstacle.y * this.scale,
                    obstacle.width * this.scale,
                    obstacle.height * this.scale
                );
            });
        }

        // Draw walkways (thin lines to represent safety rails/ropes)
        ctx.strokeStyle = '#f44336';
        ctx.lineWidth = 3; // Fixed thin line width for safety system
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        layout.walkways.forEach(walkway => {
            ctx.beginPath();
            if (walkway.type === 'line') {
                ctx.moveTo(offsetX + walkway.start.x * this.scale, offsetY + walkway.start.y * this.scale);
                ctx.lineTo(offsetX + walkway.end.x * this.scale, offsetY + walkway.end.y * this.scale);
            } else if (walkway.type === 'omega' || walkway.type === 'rahmen') {
                ctx.moveTo(offsetX + walkway.points[0].x * this.scale, offsetY + walkway.points[0].y * this.scale);
                for (let i = 1; i < walkway.points.length; i++) {
                    ctx.lineTo(offsetX + walkway.points[i].x * this.scale, offsetY + walkway.points[i].y * this.scale);
                }
            }
            ctx.stroke();
        });

        // Draw modules
        ctx.fillStyle = '#2196F3';
        ctx.strokeStyle = '#1565C0';
        ctx.lineWidth = 1;

        layout.modules.forEach(module => {
            ctx.fillRect(
                offsetX + module.x * this.scale,
                offsetY + module.y * this.scale,
                module.width * this.scale,
                module.height * this.scale
            );
            ctx.strokeRect(
                offsetX + module.x * this.scale,
                offsetY + module.y * this.scale,
                module.width * this.scale,
                module.height * this.scale
            );
        });

        // Draw anchor points
        if (layout.anchors && layout.anchors.length > 0) {
            ctx.fillStyle = '#ff9800';
            layout.anchors.forEach(anchor => {
                ctx.beginPath();
                ctx.arc(offsetX + anchor.x * this.scale, offsetY + anchor.y * this.scale, 8, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // Draw roof outline border
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(offsetX, offsetY, roofWidth * this.scale, roofLength * this.scale);

        // Draw dimensions
        this.drawDimensions(params, offsetX, offsetY);
    }

    drawDimensions(params, offsetX, offsetY) {
        const ctx = this.ctx;
        const { roofWidth, roofLength } = params;

        ctx.fillStyle = '#333';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';

        // Width dimension
        ctx.fillText(`${roofWidth} cm`, offsetX + (roofWidth * this.scale) / 2, offsetY - 5);

        // Length dimension
        ctx.save();
        ctx.translate(offsetX - 5, offsetY + (roofLength * this.scale) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(`${roofLength} cm`, 0, 0);
        ctx.restore();
    }

    exportPDF() {
        if (!this.lastLayout || !this.lastParams) {
            alert('Bitte zuerst eine Berechnung durchführen');
            return;
        }

        // Create a new window with print-friendly content
        const printWindow = window.open('', '_blank');
        const params = this.lastParams;
        const layout = this.lastLayout;

        const moduleCount = layout.modules.length;
        const totalPower = moduleCount * params.modulePower;
        const moduleArea = params.moduleWidth * params.moduleHeight / 10000;
        const coveredArea = moduleCount * moduleArea;
        const roofArea = (params.roofWidth * params.roofLength) / 10000;
        const areaUsage = (coveredArea / roofArea) * 100;

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>PV-Anlage Auslegung - Bericht</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { color: #1e3c72; }
                    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #1e3c72; color: white; }
                    .section { margin: 20px 0; }
                    img { max-width: 100%; height: auto; }
                </style>
            </head>
            <body>
                <h1>PV-Anlage Auslegung - Bericht</h1>
                <p>Erstellt am: ${new Date().toLocaleDateString('de-DE')}</p>

                <div class="section">
                    <h2>Zusammenfassung</h2>
                    <table>
                        <tr><th>Parameter</th><th>Wert</th></tr>
                        <tr><td>Anzahl Module</td><td>${moduleCount}</td></tr>
                        <tr><td>Gesamtleistung</td><td>${(totalPower / 1000).toFixed(2)} kWp</td></tr>
                        <tr><td>Belegte Fläche</td><td>${coveredArea.toFixed(1)} m²</td></tr>
                        <tr><td>Flächennutzung</td><td>${areaUsage.toFixed(1)}%</td></tr>
                        <tr><td>Reihenabstand</td><td>${params.calculatedRowSpacing.toFixed(0)} cm</td></tr>
                    </table>
                </div>

                <div class="section">
                    <h2>Eingabeparameter</h2>
                    <table>
                        <tr><th>Parameter</th><th>Wert</th></tr>
                        <tr><td>Dachbreite</td><td>${params.roofWidth} cm</td></tr>
                        <tr><td>Dachlänge</td><td>${params.roofLength} cm</td></tr>
                        <tr><td>Modulbreite</td><td>${params.moduleWidthOriginal} cm</td></tr>
                        <tr><td>Modulhöhe</td><td>${params.moduleHeightOriginal} cm</td></tr>
                        <tr><td>Modulleistung</td><td>${params.modulePower} Wp</td></tr>
                        <tr><td>Ausrichtung</td><td>${params.orientation === 'portrait' ? 'Portrait' : 'Landscape'}</td></tr>
                        <tr><td>Neigungswinkel</td><td>${params.tiltAngle}°</td></tr>
                        <tr><td>Randabstand</td><td>${params.edgeDistance} cm</td></tr>
                        <tr><td>Modulabstand</td><td>${params.moduleSpacing} cm</td></tr>
                        <tr><td>Gangbreite</td><td>${params.walkwayWidth} cm</td></tr>
                        <tr><td>Sicherungsform</td><td>${params.safetyType.toUpperCase()}-Form</td></tr>
                    </table>
                </div>

                <div class="section">
                    <h2>Layout</h2>
                    <img src="${this.canvas.toDataURL()}" alt="Dach Layout">
                </div>

                <script>window.print();</script>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    }

    exportCSV() {
        if (!this.lastLayout || !this.lastParams) {
            alert('Bitte zuerst eine Berechnung durchführen');
            return;
        }

        const params = this.lastParams;
        const layout = this.lastLayout;

        const moduleCount = layout.modules.length;
        const totalPower = moduleCount * params.modulePower;
        const moduleArea = params.moduleWidth * params.moduleHeight / 10000;
        const coveredArea = moduleCount * moduleArea;
        const roofArea = (params.roofWidth * params.roofLength) / 10000;
        const areaUsage = (coveredArea / roofArea) * 100;

        // Create CSV content
        let csv = 'Parameter,Wert,Einheit\n';
        csv += `Dachbreite,${params.roofWidth},cm\n`;
        csv += `Dachlänge,${params.roofLength},cm\n`;
        csv += `Modulbreite,${params.moduleWidthOriginal},cm\n`;
        csv += `Modulhöhe,${params.moduleHeightOriginal},cm\n`;
        csv += `Modulleistung,${params.modulePower},Wp\n`;
        csv += `Ausrichtung,${params.orientation},\n`;
        csv += `Neigungswinkel,${params.tiltAngle},°\n`;
        csv += `Randabstand,${params.edgeDistance},cm\n`;
        csv += `Modulabstand,${params.moduleSpacing},cm\n`;
        csv += `Gangbreite,${params.walkwayWidth},cm\n`;
        csv += `Sicherungsform,${params.safetyType},\n`;
        csv += `\nErgebnisse,,\n`;
        csv += `Anzahl Module,${moduleCount},Stück\n`;
        csv += `Gesamtleistung,${(totalPower / 1000).toFixed(2)},kWp\n`;
        csv += `Belegte Fläche,${coveredArea.toFixed(1)},m²\n`;
        csv += `Flächennutzung,${areaUsage.toFixed(1)},%\n`;
        csv += `Berechneter Reihenabstand,${params.calculatedRowSpacing.toFixed(0)},cm\n`;

        // Add module positions
        csv += `\nModulpositionen,,\n`;
        csv += `Modul Nr,X (cm),Y (cm)\n`;
        layout.modules.forEach((module, index) => {
            csv += `${index + 1},${module.x.toFixed(0)},${module.y.toFixed(0)}\n`;
        });

        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `pv-auslegung-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    }
}

// Global variable for obstacle removal
let calculator;

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    calculator = new PVLayoutCalculator();
});
