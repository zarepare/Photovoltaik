// PV-Modul Dachauslegung - Main Application

class PVLayoutCalculator {
    constructor() {
        this.canvas = document.getElementById('roofCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.scale = 0.1; // cm to pixels

        this.initEventListeners();
        this.calculate(); // Initial calculation
    }

    initEventListeners() {
        document.getElementById('calculateBtn').addEventListener('click', () => this.calculate());

        // Auto-recalculate on input change
        const inputs = document.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.addEventListener('change', () => this.calculate());
        });
    }

    getInputValues() {
        return {
            roofWidth: parseFloat(document.getElementById('roofWidth').value),
            roofLength: parseFloat(document.getElementById('roofLength').value),
            moduleWidth: parseFloat(document.getElementById('moduleWidth').value),
            moduleHeight: parseFloat(document.getElementById('moduleHeight').value),
            modulePower: parseFloat(document.getElementById('modulePower').value),
            edgeDistance: parseFloat(document.getElementById('edgeDistance').value),
            moduleSpacing: parseFloat(document.getElementById('moduleSpacing').value),
            walkwayWidth: parseFloat(document.getElementById('walkwayWidth').value),
            safetyType: document.getElementById('safetyType').value
        };
    }

    calculate() {
        const params = this.getInputValues();

        // Validate inputs
        if (!this.validateInputs(params)) {
            return;
        }

        // Calculate layout based on safety type
        const layout = this.calculateLayout(params);

        // Update results display
        this.updateResults(layout, params);

        // Draw visualization
        this.drawLayout(layout, params);
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
            safetyType
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
                    moduleWidth, moduleHeight, moduleSpacing, walkwayWidth
                ));
                break;
            case 'h':
                ({ modules, walkways } = this.calculateHLayout(
                    availableWidth, availableLength, edgeDistance,
                    moduleWidth, moduleHeight, moduleSpacing, walkwayWidth
                ));
                break;
            case 'i':
                ({ modules, walkways, anchors } = this.calculateILayout(
                    availableWidth, availableLength, edgeDistance,
                    moduleWidth, moduleHeight, moduleSpacing, walkwayWidth
                ));
                break;
        }

        return { modules, walkways, anchors };
    }

    calculateOmegaLayout(availableWidth, availableLength, edgeDistance, moduleWidth, moduleHeight, moduleSpacing, walkwayWidth) {
        const modules = [];
        const walkways = [];

        // Omega form: walkway forms a rectangle in the middle
        // Calculate inner rectangle for walkway
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
        // Top-left quadrant
        this.placeModulesInArea(
            modules,
            edgeDistance, edgeDistance,
            innerStartX - walkwayWidth / 2 - edgeDistance, availableLength,
            moduleWidth, moduleHeight, moduleSpacing
        );

        // Top-right quadrant
        this.placeModulesInArea(
            modules,
            innerEndX + walkwayWidth / 2, edgeDistance,
            edgeDistance + availableWidth - innerEndX - walkwayWidth / 2, availableLength,
            moduleWidth, moduleHeight, moduleSpacing
        );

        // Middle area (between walkway arms, below top walkway)
        this.placeModulesInArea(
            modules,
            innerStartX + walkwayWidth / 2, innerStartY + walkwayWidth / 2,
            innerEndX - innerStartX - walkwayWidth, availableLength - walkwayWidth,
            moduleWidth, moduleHeight, moduleSpacing
        );

        return { modules, walkways };
    }

    calculateHLayout(availableWidth, availableLength, edgeDistance, moduleWidth, moduleHeight, moduleSpacing, walkwayWidth) {
        const modules = [];
        const walkways = [];

        // H form: vertical walkway in center + horizontal walkway in middle
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
        // Top-left
        this.placeModulesInArea(
            modules,
            edgeDistance, edgeDistance,
            availableWidth / 2 - walkwayWidth / 2, availableLength / 2 - walkwayWidth / 2,
            moduleWidth, moduleHeight, moduleSpacing
        );

        // Top-right
        this.placeModulesInArea(
            modules,
            centerX + walkwayWidth / 2, edgeDistance,
            availableWidth / 2 - walkwayWidth / 2, availableLength / 2 - walkwayWidth / 2,
            moduleWidth, moduleHeight, moduleSpacing
        );

        // Bottom-left
        this.placeModulesInArea(
            modules,
            edgeDistance, centerY + walkwayWidth / 2,
            availableWidth / 2 - walkwayWidth / 2, availableLength / 2 - walkwayWidth / 2,
            moduleWidth, moduleHeight, moduleSpacing
        );

        // Bottom-right
        this.placeModulesInArea(
            modules,
            centerX + walkwayWidth / 2, centerY + walkwayWidth / 2,
            availableWidth / 2 - walkwayWidth / 2, availableLength / 2 - walkwayWidth / 2,
            moduleWidth, moduleHeight, moduleSpacing
        );

        return { modules, walkways };
    }

    calculateILayout(availableWidth, availableLength, edgeDistance, moduleWidth, moduleHeight, moduleSpacing, walkwayWidth) {
        const modules = [];
        const walkways = [];
        const anchors = [];

        // I form: single vertical walkway in center with anchor points
        const centerX = edgeDistance + availableWidth / 2;

        // Vertical walkway
        walkways.push({
            type: 'line',
            start: { x: centerX, y: edgeDistance },
            end: { x: centerX, y: edgeDistance + availableLength },
            width: walkwayWidth
        });

        // Add anchor points along the walkway
        const anchorSpacing = 300; // 3m spacing between anchors
        const numAnchors = Math.floor(availableLength / anchorSpacing) + 1;
        for (let i = 0; i < numAnchors; i++) {
            anchors.push({
                x: centerX,
                y: edgeDistance + i * (availableLength / (numAnchors - 1 || 1))
            });
        }

        // Place modules on left side
        this.placeModulesInArea(
            modules,
            edgeDistance, edgeDistance,
            availableWidth / 2 - walkwayWidth / 2, availableLength,
            moduleWidth, moduleHeight, moduleSpacing
        );

        // Place modules on right side
        this.placeModulesInArea(
            modules,
            centerX + walkwayWidth / 2, edgeDistance,
            availableWidth / 2 - walkwayWidth / 2, availableLength,
            moduleWidth, moduleHeight, moduleSpacing
        );

        return { modules, walkways, anchors };
    }

    placeModulesInArea(modules, startX, startY, areaWidth, areaHeight, moduleWidth, moduleHeight, spacing) {
        if (areaWidth <= 0 || areaHeight <= 0) return;

        // Calculate how many modules fit
        const modulesPerRow = Math.floor((areaWidth + spacing) / (moduleWidth + spacing));
        const modulesPerCol = Math.floor((areaHeight + spacing) / (moduleHeight + spacing));

        if (modulesPerRow <= 0 || modulesPerCol <= 0) return;

        // Center the modules in the available area
        const totalModuleWidth = modulesPerRow * moduleWidth + (modulesPerRow - 1) * spacing;
        const totalModuleHeight = modulesPerCol * moduleHeight + (modulesPerCol - 1) * spacing;
        const offsetX = (areaWidth - totalModuleWidth) / 2;
        const offsetY = (areaHeight - totalModuleHeight) / 2;

        for (let row = 0; row < modulesPerCol; row++) {
            for (let col = 0; col < modulesPerRow; col++) {
                modules.push({
                    x: startX + offsetX + col * (moduleWidth + spacing),
                    y: startY + offsetY + row * (moduleHeight + spacing),
                    width: moduleWidth,
                    height: moduleHeight
                });
            }
        }
    }

    updateResults(layout, params) {
        const moduleCount = layout.modules.length;
        const totalPower = moduleCount * params.modulePower;
        const moduleArea = params.moduleWidth * params.moduleHeight / 10000; // cm² to m²
        const coveredArea = moduleCount * moduleArea;
        const roofArea = (params.roofWidth * params.roofLength) / 10000; // cm² to m²
        const areaUsage = (coveredArea / roofArea) * 100;

        document.getElementById('moduleCount').textContent = moduleCount;
        document.getElementById('totalPower').textContent = `${(totalPower / 1000).toFixed(2)} kWp`;
        document.getElementById('coveredArea').textContent = `${coveredArea.toFixed(1)} m²`;
        document.getElementById('areaUsage').textContent = `${areaUsage.toFixed(1)}%`;
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
        ctx.fillRect(
            offsetX, offsetY,
            roofWidth * this.scale,
            roofLength * this.scale
        );

        // Draw available area (after edge distance)
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(
            offsetX + edgeDistance * this.scale,
            offsetY + edgeDistance * this.scale,
            (roofWidth - 2 * edgeDistance) * this.scale,
            (roofLength - 2 * edgeDistance) * this.scale
        );

        // Draw walkways
        ctx.strokeStyle = '#f44336';
        ctx.lineWidth = params.walkwayWidth * this.scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        layout.walkways.forEach(walkway => {
            ctx.beginPath();
            if (walkway.type === 'line') {
                ctx.moveTo(
                    offsetX + walkway.start.x * this.scale,
                    offsetY + walkway.start.y * this.scale
                );
                ctx.lineTo(
                    offsetX + walkway.end.x * this.scale,
                    offsetY + walkway.end.y * this.scale
                );
            } else if (walkway.type === 'omega') {
                ctx.lineWidth = walkway.width * this.scale;
                ctx.moveTo(
                    offsetX + walkway.points[0].x * this.scale,
                    offsetY + walkway.points[0].y * this.scale
                );
                for (let i = 1; i < walkway.points.length; i++) {
                    ctx.lineTo(
                        offsetX + walkway.points[i].x * this.scale,
                        offsetY + walkway.points[i].y * this.scale
                    );
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

        // Draw anchor points (for I-Form)
        if (layout.anchors && layout.anchors.length > 0) {
            ctx.fillStyle = '#ff9800';
            layout.anchors.forEach(anchor => {
                ctx.beginPath();
                ctx.arc(
                    offsetX + anchor.x * this.scale,
                    offsetY + anchor.y * this.scale,
                    8, 0, Math.PI * 2
                );
                ctx.fill();
            });
        }

        // Draw roof outline border
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            offsetX, offsetY,
            roofWidth * this.scale,
            roofLength * this.scale
        );

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
        ctx.fillText(
            `${roofWidth} cm`,
            offsetX + (roofWidth * this.scale) / 2,
            offsetY - 5
        );

        // Length dimension
        ctx.save();
        ctx.translate(offsetX - 5, offsetY + (roofLength * this.scale) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(`${roofLength} cm`, 0, 0);
        ctx.restore();
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PVLayoutCalculator();
});
