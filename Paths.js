sap.ui.define([
    "sap/ui/core/Control",
    "sap/m/Dialog",
    "sap/m/Input",
    "sap/m/ColorPalettePopover",
    "sap/m/Button",
    "sap/m/Label",
    "sap/ui/layout/form/SimpleForm"
], function(Control, Dialog, Input, ColorPalettePopover, Button, Label, SimpleForm) {
    "use strict";

    return Control.extend("ui5.flowdesigner.control.Paths", {
        metadata: {
            properties: {
                width: { type: "string", defaultValue: "100%" },
                height: { type: "string", defaultValue: "700px" }
            },
            events: {
                nodeAdded: {
                    parameters: {
                        nodeId: { type: "string" }
                    }
                },
                connectionCreated: {
                    parameters: {
                        connection: { type: "object" }
                    }
                },
                connectionRemoved: {
                    parameters: {
                        connection: { type: "object" }
                    }
                }
            }
        },

        init: function() {
            this._nodeCounter = 0;
            this._currentScale = 1;
            this._minScale = 0.2;
            this._maxScale = 15;
            this._nodePositions = {};
            this._levelHeight = 170;
            this._horizontalSpacing = 200;
            this._translateX = 0;
            this._translateY = 0;
            this._isPanningEnabled = false;

            this._sampleData = {
                "nodes": [
                    { "id": "1", "label": "Start" },
                    { "id": "2", "label": "Process A" },
                    { "id": "3", "label": "Process B" },
                    { "id": "4", "label": "Process C" },
                    { "id": "5", "label": "Process D" },
                    { "id": "6", "label": "Process E" }
                ],
                "connections": [
                    { "source": "1", "target": "2" },
                    { "source": "1", "target": "3" },
                    { "source": "2", "target": "4" },
                    { "source": "2", "target": "5" },
                    { "source": "3", "target": "6" }
                ]
            };
        },

        onAfterRendering: function() {
            if (Control.prototype.onAfterRendering) {
                Control.prototype.onAfterRendering.apply(this, arguments);
            }

            var canvasId = this.getId() + "-canvas";
            var that = this;

            // Initialize jsPlumb
            this.jsPlumb = jsPlumb.getInstance({
                Container: canvasId,
                Endpoint: ["Dot", { radius: 6 }],
                EndpointStyle: { 
                    fill: "#FF6666", 
                    stroke: "#FF4D4D", 
                    strokeWidth: 2,
                    radius: 6
                },
                Connector: ["Straight", { curviness: 20 }],
                HoverPaintStyle: { stroke: "#1e8151", strokeWidth: 3 },
                ConnectionOverlays: [
                    ["Arrow", {
                        location: 1,
                        id: "arrow",
                        width: 12,
                        length: 12,
                        foldback: 0.8
                    }],
                    ["Custom", {
                        create: function(component) {
                            var wrapper = document.createElement("div");
                            wrapper.className = "custom-connection-overlay";

                            var removeButton = document.createElement("div");
                            removeButton.className = "connection-remove-button";
                            removeButton.innerHTML = "X";
                            removeButton.addEventListener("click", function(e) {
                                e.preventDefault();
                                e.stopPropagation();
                                that.jsPlumb.deleteConnection(component);
                            });

                            wrapper.appendChild(removeButton);
                            return wrapper;
                        },
                        location: 0.5,
                        id: "customOverlay",
                        events: {
                            click: function(overlay, event) {
                                event.preventDefault();
                                event.stopPropagation();
                
                                // Find the connection associated with the overlay
                                var connection = overlay.component;
                
                                // Delete the connection
                                if (connection) {
                                    that.jsPlumb.deleteConnection(connection);
                                }
                            }
                        }
                    }]
                ]
            });

            this.jsPlumb.bind("beforeDetach", function(info) {
                return true;
            });

            this.jsPlumb.draggable(document.querySelectorAll(".flowNode"), {
                containment: canvasId
            });

            // Attach connection listener
            this.jsPlumb.bind("connection", function(info) {
                console.log("Connection created:", info.sourceId, "to", info.targetId);
                that.fireConnectionCreated({
                    connection: {
                        sourceId: info.sourceId,
                        targetId: info.targetId,
                        connection: info.connection
                    }
                });
            });
            
            // Bind connection detach listener
            this.jsPlumb.bind("connectionDetached", function(info) {
                console.log("Connection detached:", info.sourceId, "to", info.targetId);
                that.fireConnectionRemoved({
                    connection: {
                        sourceId: info.sourceId,
                        targetId: info.targetId,
                        connection: info.connection
                    }
                });
            });

            // Implement edit connection dialog on connection click
            this.jsPlumb.bind("click", function(connection, originalEvent) {
                that._openEditConnectionDialog(connection);
            });

            var canvas = document.getElementById(this.getId() + "-canvas");
            var isPanning = false;
            var panStartX, panStartY;

            // Add event listeners for zoom buttons
            var zoomInButton = document.getElementById(this.getId() + "-zoomIn");
            var zoomOutButton = document.getElementById(this.getId() + "-zoomOut");
            var panButton = document.getElementById(this.getId() + "-togglePanMode");

            if (zoomInButton) {
                zoomInButton.addEventListener("click", function() {
                    that._zoomIn();
                });
            }

            if (zoomOutButton) {
                zoomOutButton.addEventListener("click", function() {
                    that._zoomOut();
                });
            }

            // Toggle panning mode
            if (panButton) {
                panButton.addEventListener("click", function() {
                    that._isPanningEnabled = !that._isPanningEnabled;
                    panButton.classList.toggle("active", that._isPanningEnabled);
                    canvas.style.cursor = that._isPanningEnabled ? "grab" : "default";
                });
            }

            // Mouse events for panning
            canvas.addEventListener("mousedown", function(event) {
                if (event.button === 0 && that._isPanningEnabled) { // Left mouse button & panning enabled
                    isPanning = true;
                    panStartX = event.clientX - that._translateX;
                    panStartY = event.clientY - that._translateY;
                    canvas.style.cursor = "grabbing";
                }
            });

            document.addEventListener("mousemove", function(event) {
                if (isPanning) {
                    that._translateX = event.clientX - panStartX;
                    that._translateY = event.clientY - panStartY;
                    that._applyTransform();
                }
            });

            document.addEventListener("mouseup", function() {
                if (isPanning) {
                    isPanning = false;
                    canvas.style.cursor = that._isPanningEnabled ? "grab" : "default";
                }
            });
        },

        renderer: function(oRm, oControl) {
            oRm.write("<div");
            oRm.writeControlData(oControl);
            oRm.addClass("flowDesignerContainer");
            oRm.writeClasses();
            oRm.addStyle("width", oControl.getWidth());
            oRm.addStyle("height", oControl.getHeight());
            oRm.writeStyles();
            oRm.write(">");

            // The zoomable area (canvas)
            oRm.write("<div class='playgroundContainer'>");

            // Canvas for the diagram (ZOOMABLE area)
            oRm.write("<div id='" + oControl.getId() + "-canvas' class='flowCanvas'>");
            oRm.write("</div>");

            oRm.write("</div>"); // Close .playgroundContainer

            // Close the flowDesignerContainer
            oRm.write("</div>");

            // Move zoom controls completely outside the main container (the canvas)
            oRm.write("<div class='controlsWrapper'>");

            // FlowToolbar for buttons
            oRm.write("<div class='flowToolbar'>");
            oRm.renderControl(new Button({
                text: "Load Data",
                press: function() {
                    oControl.loadSampleData();
                }
            }));
            oRm.renderControl(new Button({
                text: "Auto Arrange",
                press: function() {
                    oControl.autoArrangeNodes();
                }
            }));
            oRm.renderControl(new Button({
                text: "Add Node",
                press: function() {
                    oControl.addNode();
                }
            }));
            // Clear button below the Drag button
            oRm.renderControl(new Button({
                text: "Clear",
                press: function() {
                    oControl.clearBoard();
                },
                type: "Reject", // Use "Reject" type for red color
                class: "clearButton" // Add a custom CSS class for styling
            }));
            
            oRm.write("</div>");

            // Zoom controls fixed at the bottom-right
            oRm.write("<div class='zoomControlsContainer'>");
            oRm.write("<button id='" + oControl.getId() + "-zoomIn' class='zoomButton'>+</button>");
            oRm.write("<button id='" + oControl.getId() + "-zoomOut' class='zoomButton'>-</button>");
            oRm.write("<button id='" + oControl.getId() + "-togglePanMode' class='zoomButton handButton'>Drag</button>");
            oRm.write("</div>");

            oRm.write("</div>"); // Close controlsWrapper
        },

        _zoomIn: function() {
            this._currentScale = Math.min(this._currentScale + 0.1, this._maxScale); // Limit to max scale
            this._applyZoom();
        },
        
        _zoomOut: function() {
            this._currentScale = Math.max(this._currentScale - 0.1, this._minScale); // Limit to min scale
            this._applyZoom();
        },
        
        _applyZoom: function() {
            this._applyTransform();
        },

        _applyTransform: function() {
            var canvas = document.getElementById(this.getId() + "-canvas");
            if (canvas) {
                canvas.style.transformOrigin = "top left";
                canvas.style.transform = `translate(${this._translateX}px, ${this._translateY}px) scale(${this._currentScale})`;
                this.jsPlumb.setZoom(this._currentScale);
            }
        },

        clearBoard: function() {
            var canvasId = this.getId() + "-canvas";
            var canvas = document.getElementById(canvasId);

            // Remove all connections
            this.jsPlumb.deleteEveryEndpoint();
            this.jsPlumb.deleteEveryConnection();

            // Remove all nodes
            var nodes = document.querySelectorAll(".flowNode");
            nodes.forEach(function(node) {
                canvas.removeChild(node);
            });

            // Reset node counter and positions
            this._nodeCounter = 0;
            this._nodePositions = {};
            this.jsPlumb.repaintEverything();
        },

        loadSampleData: function() {
            var that = this;
            this.createNodesAndConnections(this._sampleData);
            setTimeout(function() {
                that.autoArrangeNodes(); // Call autoArrangeNodes after loading data
            }, 500); // Slight delay to ensure nodes are rendered
        },
        
        createNodesAndConnections: function(data) {
            var that = this;
        
            this.clearBoard(); // Clear the board before loading new data
        
            data.nodes.forEach(function(node) {
                that.addNode(
                    100 + Math.floor(Math.random() * 400),
                    50 + Math.floor(Math.random() * 300),
                    node.id,
                    node.label
                );
            });
        
            setTimeout(function() {
                // Initial connections
                data.connections.forEach(function(connection) {
                    try {
                        that.jsPlumb.connect({
                            source: connection.source,
                            target: connection.target,
                            anchors: ["Bottom", "Top"],
                            connector: ["Straight"], // Ensure the connector is straight
                            paintStyle: { stroke: "blue", strokeWidth: 2 }
                        });
                    } catch (e) {
                        console.error("Error creating connection:", e);
                    }
                });
        
                that.fixEndpointRendering();
                that.jsPlumb.repaintEverything();
            }, 500); // Slight delay to ensure nodes are rendered before connecting
        },

        fixEndpointRendering: function() {
            var that = this;
        
            // First apply CSS to ensure endpoints are above connections
            var style = document.createElement('style');
            style.type = 'text/css';
            style.innerHTML = `
                .jtk-endpoint {
                    z-index: 30 !important;
                }
                .jtk-connector {
                    z-index: 5 !important;
                }
                .jtk-overlay {
                    z-index: 40 !important;
                }
            `;
            document.head.appendChild(style);
        
            // Then force repaint of all endpoints to ensure proper rendering
            document.querySelectorAll(".flowNode").forEach(function(node) {
                let nodeId = node.id;
        
                // Get all endpoints for this node
                var eps = that.jsPlumb.getEndpoints(nodeId);
                if (eps) {
                    eps.forEach(function(ep) {
                        // Temporarily detach and reattach endpoints to force correct rendering
                        that.jsPlumb.deleteEndpoint(ep);
        
                        // Recreate the endpoint with proper z-index
                        var isSource = ep.isSource;
                        var isTarget = ep.isTarget;
                        var anchor = isSource ? "Bottom" : "Top";
        
                        that.jsPlumb.addEndpoint(nodeId, {
                            anchor: anchor,
                            isSource: isSource,
                            isTarget: isTarget,
                            endpoint: ["Dot", { radius: 6 }],
                            paintStyle: {
                                fill: isSource ? "#FF6666" : "#6699FF",
                                stroke: isSource ? "#FF4D4D" : "#4D88FF",
                                strokeWidth: 2
                            },
                            maxConnections: -1,
                            connector: ["Straight", { curviness: 50, stub: 30 }],
                            zIndex: 10 // Ensure zIndex is set during endpoint creation
                        });
                    });
                }
            });
        
            // Update connections and repaint everything
            that.jsPlumb.repaintEverything();
        },

        addNode: function(x, y, id, label) {
            var canvasId = this.getId() + "-canvas";
            var canvas = document.getElementById(canvasId);
        
            var nodeId = id || "node" + (++this._nodeCounter);
            var nodeLabel = label || "JC " + this._nodeCounter;
        
            if (!x) x = 100 + Math.floor(Math.random() * 400);
            if (!y) y = 50 + Math.floor(Math.random() * 300);
        
            var nodeEl = document.createElement("div");
            nodeEl.id = nodeId;
            nodeEl.className = "flowNode";
        
            var nodeContents = document.createElement("div");
            nodeContents.className = "nodeContents";
            nodeContents.innerHTML = nodeLabel;
        
            var removeButton = document.createElement("div");
            removeButton.className = "node-remove-button";
            removeButton.innerHTML = "×";
        
            var that = this;
            removeButton.addEventListener("click", function(event) {
                event.stopPropagation();
        
                if (window.confirm("Delete node " + nodeId + "?")) {
                    that.jsPlumb.deleteConnectionsForElement(nodeId);
                    that.jsPlumb.removeAllEndpoints(nodeId);
                    canvas.removeChild(nodeEl);
                }
            });
        
            nodeEl.appendChild(nodeContents);
            nodeEl.appendChild(removeButton);
        
            nodeEl.style.left = x + "px";
            nodeEl.style.top = y + "px";
        
            canvas.appendChild(nodeEl);
        
            this.jsPlumb.draggable(nodeEl, {
                containment: canvasId,
                stop: function(event) {
                    that._nodePositions[nodeId] = {
                        x: parseInt(nodeEl.style.left),
                        y: parseInt(nodeEl.style.top)
                    };
                    that.jsPlumb.repaintEverything();
                }
            });
        
            setTimeout(function() {
                that.jsPlumb.addEndpoint(nodeId, {
                    anchor: "Top",
                    isSource: false,
                    isTarget: true,
                    endpoint: ["Dot", { radius: 6 }],
                    paintStyle: { fill: "#6699FF", stroke: "#4D88FF", strokeWidth: 2 },
                    maxConnections: -1
                });
        
                that.jsPlumb.addEndpoint(nodeId, {
                    anchor: "Bottom",
                    isSource: true,
                    isTarget: false,
                    endpoint: ["Dot", { radius: 6 }],
                    paintStyle: { fill: "#FF6666", stroke: "#FF4D4D", strokeWidth: 2 },
                    maxConnections: -1,
                    connector: ["Straight"]  // Ensure the connector is straight
                });
            }, 50);
        
            this.fireNodeAdded({
                nodeId: nodeId
            });
        
            return nodeId;
        },

        _openEditConnectionDialog: function(connection) {
            var that = this;
            var oDialog = new Dialog({
                title: "Edit Connection Properties",
                contentWidth: "500px",
                content: [
                    new SimpleForm({
                        layout: "ResponsiveGridLayout",
                        editable: true,
                        content: [
                            new Label({ text: "Connection Label" }),
                            new Input({
                                value: connection.getLabel() || "",
                                change: function(oEvent) {
                                    connection.setLabel(oEvent.getParameter("newValue"));
                                }
                            }),
                            new Label({ text: "Connection Color" }),
                            new ColorPalettePopover({
                                colorSelected: function(oEvent) {
                                    var color = oEvent.getParameter("value");
                                    connection.setPaintStyle({ stroke: color, strokeWidth: 3 });
                                }
                            })
                        ]
                    })
                ],
                buttons: [
                    new Button({
                        text: "OK",
                        press: function() {
                            oDialog.close();
                        }
                    }),
                    new Button({
                        text: "Cancel",
                        press: function() {
                            oDialog.close();
                        }
                    })
                ],
                afterClose: function() {
                    oDialog.destroy();
                }
            });
            oDialog.open();
        },

        autoArrangeNodes: function() {
            var that = this;
            var canvas = document.getElementById(this.getId() + "-canvas");
            var nodes = document.querySelectorAll(".flowNode");
        
            if (!canvas) {
                console.error("Canvas element not found!");
                return;
            }
        
            if (!nodes || nodes.length === 0) {
                console.warn("No nodes to arrange.");
                return;
            }
        
            // Layout parameters
            const NODE_SPACING_X = 120;
            const NODE_SPACING_Y = 100;
            const START_Y = 50;
        
            // Store complete connection data
            var connectionData = this.jsPlumb.getAllConnections().map(function(conn) {
                return {
                    sourceId: conn.sourceId,
                    targetId: conn.targetId,
                    paintStyle: conn.getPaintStyle(),
                    hoverPaintStyle: conn.getHoverPaintStyle(),
                    overlays: conn.getOverlays ? Object.values(conn.getOverlays()).map(overlay => {
                        return overlay.getOptions ? overlay.getOptions() : overlay;
                    }) : [],
                    anchors: [
                        conn.endpoints[0].anchor.type,
                        conn.endpoints[1].anchor.type
                    ]
                };
            });
        
            // Build node hierarchy
            var nodeMap = {};
            var rootNodes = [];
            Array.from(nodes).forEach(node => {
                nodeMap[node.id] = {
                    id: node.id,
                    children: [],
                    parent: null,
                    element: node,
                    x: 0,
                    y: 0,
                    width: node.offsetWidth,
                    height: node.offsetHeight
                };
            });
        
            // Build parent/child relationships
            connectionData.forEach(conn => {
                const parent = nodeMap[conn.sourceId];
                const child = nodeMap[conn.targetId];
                if (parent && child) {
                    parent.children.push(child);
                    child.parent = parent;
                }
            });
        
            // Find root nodes (nodes with no parents)
            rootNodes = Object.values(nodeMap).filter(node => !node.parent);
        
            // If no root nodes found, use the first node as a root
            if (rootNodes.length === 0 && nodes.length > 0) {
                rootNodes = [nodeMap[nodes[0].id]];
            }
        
            // Function to recursively calculate total width
            function calculateTotalWidth(node) {
                if (!node.children || node.children.length === 0) {
                    return node.width + NODE_SPACING_X;
                }
        
                let childrenWidth = 0;
                node.children.forEach(child => {
                    childrenWidth += calculateTotalWidth(child);
                });
        
                return Math.max(node.width, childrenWidth) + NODE_SPACING_X;
            }
        
            // Function to recursively position nodes
            function positionNodes(node, startX, level) {
                node.x = Math.max(startX, 0);  // Ensure x is not negative
                node.y = START_Y + (level * NODE_SPACING_Y);
        
                if (!node.children || node.children.length === 0) {
                    return;
                }
        
                let childrenWidth = 0;
                node.children.forEach(child => {
                    childrenWidth += calculateTotalWidth(child);
                });
        
                // Center children under the parent node
                let childStartX = startX + (node.width - childrenWidth) / 2;
                node.children.forEach(child => {
                    positionNodes(child, childStartX, level + 1);
                    childStartX += calculateTotalWidth(child);
                });
            }
        
            // Calculate total width for centering
            let totalWidth = 0;
            rootNodes.forEach(root => {
                totalWidth += calculateTotalWidth(root);
            });
        
            // Calculate starting position to center nodes
            let centerX = Math.max((canvas.offsetWidth - totalWidth) / 2, 0);
        
            // Position root nodes
            let currentX = centerX;
            rootNodes.forEach(root => {
                positionNodes(root, currentX, 0);
                currentX += calculateTotalWidth(root);
            });
        
            // Function to check for overlapping nodes and adjust positions
            function checkForOverlaps(nodeMap) {
                const nodesArray = Object.values(nodeMap);
                let hasOverlaps = false;
        
                nodesArray.forEach((nodeA, indexA) => {
                    nodesArray.forEach((nodeB, indexB) => {
                        if (indexA !== indexB) {
                            if (isOverlapping(nodeA, nodeB)) {
                                adjustPosition(nodeA, nodeB);
                                hasOverlaps = true;
                            }
                        }
                    });
                });
        
                // If there were overlaps, check again
                if (hasOverlaps) {
                    checkForOverlaps(nodeMap);
                }
            }
        
            // Function to determine if two nodes are overlapping
            function isOverlapping(nodeA, nodeB) {
                return !(
                    nodeA.x + nodeA.width < nodeB.x ||
                    nodeA.x > nodeB.x + nodeB.width ||
                    nodeA.y + nodeA.height < nodeB.y ||
                    nodeA.y > nodeB.y + nodeB.height
                );
            }
        
            // Function to adjust positions of overlapping nodes
            function adjustPosition(nodeA, nodeB) {
                if (nodeA.x < nodeB.x) {
                    nodeA.x -= NODE_SPACING_X;
                    nodeB.x += NODE_SPACING_X;
                } else {
                    nodeA.x += NODE_SPACING_X;
                    nodeB.x -= NODE_SPACING_X;
                }
        
                if (nodeA.y < nodeB.y) {
                    nodeA.y -= NODE_SPACING_Y;
                    nodeB.y += NODE_SPACING_Y;
                } else {
                    nodeA.y += NODE_SPACING_Y;
                    nodeB.y -= NODE_SPACING_Y;
                }
            }
        
            // Apply positions to DOM and check for overlaps
            Object.values(nodeMap).forEach(node => {
                node.element.style.position = 'absolute';
                node.element.style.left = node.x + 'px';
                node.element.style.top = node.y + 'px';
        
                // Save the node's position
                that._nodePositions[node.id] = {
                    x: node.x,
                    y: node.y
                };
            });
        
            // Check for overlapping nodes and adjust positions
            checkForOverlaps(nodeMap);
        
            // Center the graph within the canvas
            let minX = Math.min(...Object.values(nodeMap).map(node => node.x));
            let minY = Math.min(...Object.values(nodeMap).map(node => node.y));
        
            let translateX = (canvas.offsetWidth - (Math.max(...Object.values(nodeMap).map(node => node.x + node.width)) - minX)) / 2 - minX;
            let translateY = (canvas.offsetHeight - (Math.max(...Object.values(nodeMap).map(node => node.y + node.height)) - minY)) / 2 - minY;
        
            Object.values(nodeMap).forEach(node => {
                node.element.style.left = (node.x + translateX) + 'px';
                node.element.style.top = (node.y + translateY) + 'px';
        
                // Update the node's position
                that._nodePositions[node.id] = {
                    x: node.x + translateX,
                    y: node.y + translateY
                };
            });
        
            // Recreate connections after DOM update
            setTimeout(() => {
                // Delete all existing connections
                that.jsPlumb.deleteEveryConnection();
        
                // Recreate connections based on stored data
                connectionData.forEach(conn => {
                    try {
                        that.jsPlumb.connect({
                            source: conn.sourceId,
                            target: conn.targetId,
                            anchors: conn.anchors,
                            paintStyle: conn.paintStyle,
                            hoverPaintStyle: conn.hoverPaintStyle,
                            connector: ["Straight", { curviness: 50, stub: 30 }]
                        });
                    } catch (e) {
                        console.error("Error recreating connection:", e);
                    }
                });
        
                // Reinitialize endpoints on all nodes
                nodes.forEach(node => {
                    that.jsPlumb.makeSource(node, {
                        endpoint: "Dot",
                        paintStyle: { fill: "#3498db", radius: 5 },
                        anchor: "Bottom"
                    });
        
                    that.jsPlumb.makeTarget(node, {
                        endpoint: "Dot",
                        paintStyle: { fill: "#e74c3c", radius: 5 },
                        anchor: "Top"
                    });
                });
        
                // Force redraw of all elements
                that.jsPlumb.repaintEverything();
                console.log("Auto-arrange completed with", connectionData.length, "connections restored");
            }, 300);
        },

        deleteConnection: function(sourceId, targetId) {
            var connections = this.jsPlumb.getConnections({
                source: sourceId,
                target: targetId
            });

            if (connections && connections.length > 0) {
                this.jsPlumb.deleteConnection(connections[0]);
            }
        }
    });
});