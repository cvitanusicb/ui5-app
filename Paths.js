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
                width: { type: "string", defaultValue: "100%" }, // Use "string" instead of "sap.ui.core.CSSSize"
                height: { type: "string", defaultValue: "600px" } // Use "string" instead of "sap.ui.core.CSSSize"
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
            this._levelHeight = 150;
            this._horizontalSpacing = 200;

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

            // Initialize jsPlumb
            this.jsPlumbInstance = jsPlumb.getInstance({
                Connector: ["Bezier", { curviness: 70 }],
                Endpoint: ["Dot", { radius: 5 }],
                EndpointStyle: { fill: "#456" },
                PaintStyle: { stroke: "#898989", strokeWidth: 2 },
                HoverPaintStyle: { stroke: "red" },
                Container: this.getDomRef() // Set the container to the control's DOM
            });

            // Ensure jsPlumbInstance is initialized
            if (!this.jsPlumbInstance) {
                this.jsPlumbInstance = jsPlumb.getInstance();
            }

            // Suspend drawing and batch operations
            this.jsPlumbInstance.batch(() => {
                // Configure the delete connection overlay
                const deleteConnectionOverlay = [
                    "Custom", {
                        location: 0.5, // Middle of the connection
                        id: "delete",
                        cssClass: "custom-connection-overlay",
                        create: function () {
                            let wrapper = document.createElement("div");
                            wrapper.innerHTML = '<div class="connection-remove-button">x</div>';
                            wrapper.addEventListener("click", function (event) {
                                event.preventDefault();
                                event.stopPropagation();

                                // Remove the connection
                                const connection = jsPlumb.getConnections().find(conn => conn.getOverlay("delete") === wrapper);
                                if (connection) {
                                    this.jsPlumbInstance.deleteConnection(connection);
                                }
                            }.bind(this)); // Ensure context binding

                            return wrapper;
                        }
                    }
                ];

                // Configure the Label overlay
                const labelOverlay = [
                    "Label", {
                        label: "Custom Label",
                        location: 0.1,
                        cssClass: "connectionLabel",
                        events: {
                            click: function (labelOverlay, originalEvent) {
                                console.log("Label overlay clicked");
                            }
                        }
                    }
                ];

                // Set common configuration for all connections
                this.jsPlumbInstance.registerConnectionType("basic", {
                    detachable: true,
                    overlays: [deleteConnectionOverlay, labelOverlay],
                    deleteEndpointsOnDetach: false,
                });

            }); 

            // Listen for connection events
            this.jsPlumbInstance.bind("connection", function (info, originalEvent) {
                // Fire the connectionCreated event
                this.fireConnectionCreated({ connection: info });
            }.bind(this));

            this.jsPlumbInstance.bind("connection:detach", function (info, originalEvent) {
                // Fire the connectionRemoved event
                this.fireConnectionRemoved({ connection: info });
            }.bind(this));
        },

        // After rendering, initialize jsPlumb and draw connections
        onAfterRendering: function() {
            // Call the parent's after rendering function
            if (Control.prototype.onAfterRendering) {
                Control.prototype.onAfterRendering.apply(this, arguments);
            }
            this.jsPlumbInstance.setContainer(this.getDomRef());

            // Draw connections
            this._drawConnections();
        },

        _drawConnections: function() {
            // Clear existing connections
            this.jsPlumbInstance.reset();

            // Set jsPlumb container
            this.jsPlumbInstance.setContainer(this.getDomRef());

            // Draw connections from sample data
            this._sampleData.connections.forEach(function(connection) {
                this.jsPlumbInstance.connect({
                    source: connection.source,
                    target: connection.target,
                    type: "basic" // Apply common connection configuration
                });
            }.bind(this)); // Bind the context to this control
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
            oRm.renderControl(new sap.m.Button({
                text: "Load Data",
                press: function() {
                    oControl.loadSampleData();
                }
            }));
            oRm.renderControl(new sap.m.Button({
                text: "Auto Arrange",
                press: function() {
                    oControl.autoArrangeNodes();
                }
            }));
            oRm.renderControl(new sap.m.Button({
                text: "Add Node",
                press: function() {
                    oControl.addNode();
                }
            }));
            // Clear button below the Drag button
            oRm.renderControl(new sap.m.Button({
                text: "Clear",
                press: function () {
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
        onAfterRendering: function() {
            if (Control.prototype.onAfterRendering) {
                Control.prototype.onAfterRendering.apply(this, arguments);
            }

            var canvasId = this.getId() + "-canvas";
            var that = this;
            this._translateX = 0;
            this._translateY = 0;
            this._isPanningEnabled = false; // Flag to track panning mode

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
                Connector: ["Bezier", { curviness: 50 }],
                HoverPaintStyle: { stroke: "#1e8151", strokeWidth: 3 },
                ConnectionOverlays: [
                    ["Arrow", {
                        location: 1,
                        id: "arrow",
                        width: 12,
                        length: 12,
                        foldback: 0.8 // Adjust arrow shape
                    }],
                    ["Custom", {
                        create: function(component) { // 'component' is the connection
                            var wrapper = document.createElement("div");
                            wrapper.className = "custom-connection-overlay";

                            var removeButton = document.createElement("div");
                            removeButton.className = "connection-remove-button";
                            removeButton.innerHTML = "X";
                            removeButton.addEventListener("click", function(e) {
                                e.preventDefault();
                                e.stopPropagation();
                                that.jsPlumb.deleteConnection(component); // Delete the connection
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
                ],
                // PaintStyle: { stroke: "blue", strokeWidth: 2 },
                // ConnectorZIndex: 5
            });

            

            this.jsPlumb.bind("beforeDetach", function(info) {
                // Check if the user confirms before detaching
                // return window.confirm("Delete connection from " + info.sourceId + " to " + info.targetId + "?");
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
            canvas.addEventListener("mousedown", function (event) {
                if (event.button === 0 && that._isPanningEnabled) { // Left mouse button & panning enabled
                    isPanning = true;
                    panStartX = event.clientX - that._translateX;
                    panStartY = event.clientY - that._translateY;
                    canvas.style.cursor = "grabbing";
                }
            });

            document.addEventListener("mousemove", function (event) {
                if (isPanning) {
                    that._translateX = event.clientX - panStartX;
                    that._translateY = event.clientY - panStartY;
                    that._applyTransform();
                }
            });

            document.addEventListener("mouseup", function () {
                if (isPanning) {
                    isPanning = false;
                    canvas.style.cursor = "grab";
                }
            });
        },

        _zoomIn: function() {
            this._currentScale = Math.min(this._currentScale + 0.1, this._maxScale); // Limit to max scale
            this._applyZoom();
        },
        _zoomOut: function() {
            this._currentScale = Math.max(this._currentScale - 0.1, this._minScale); // Limit to min scale
            this._applyZoom();
        },
        // Apply Zoom & Transform (Handles Both Scaling & Panning)
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

        // Add method to clear the board
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

        // In the loadSampleData method, modify it to:
        loadSampleData: function () {
            var that = this;
            this.createNodesAndConnections(this._sampleData);
            setTimeout(function() {
                that.autoArrangeNodes(); // Call autoArrangeNodes after loading data
            }, 500); // Slight delay to ensure nodes are rendered
        },
        createNodesAndConnections: function (data) {
            var that = this;
        
            this.clearBoard();
        
            data.nodes.forEach(function (node) {
                that.addNode(
                    100 + Math.floor(Math.random() * 400),
                    50 + Math.floor(Math.random() * 300),
                    node.id,
                    node.label
                );
            });
        
            this._pendingConnections = data.connections;
        
            setTimeout(function() {
                // Initial connections
                that._pendingConnections.forEach(function (connection) {
                    try {
                        that.jsPlumb.connect({
                            source: connection.source,
                            target: connection.target,
                            anchors: ["Bottom", "Top"],
                            connector: ["Bezier", { curviness: 50, stub: 30 }],
                            paintStyle: { stroke: "blue", strokeWidth: 2 }
                        });
                    } catch (e) {
                        console.error("Error creating connection:", e);
                    }
                });
        
                setTimeout(function() {
                    // Store connections
                    var currentConnections = that.jsPlumb.getConnections().map(function(connection) {
                        return {
                            sourceId: connection.sourceId,
                            targetId: connection.targetId,
                            paintStyle: connection.getPaintStyle(),
                            connector: connection.getConnector().type,
                            anchors: [
                                connection.endpoints[0].anchor.type,
                                connection.endpoints[1].anchor.type
                            ],
                            label: connection.getLabel ? connection.getLabel() : ""
                        };
                    });
        
                    // Delete connections
                    that.jsPlumb.deleteEveryConnection();
        
                    // Arrange nodes
                    that._arrangeNodesWithoutConnections();
        
                    setTimeout(function() {
                        // Recreate connections
                        currentConnections.forEach(function(conn) {
                            try {
                                var newConnection = that.jsPlumb.connect({
                                    source: conn.sourceId,
                                    target: conn.targetId,
                                    anchors: [conn.anchors[0], conn.anchors[1]],
                                    connector: [conn.connector, { curviness: 50, stub: 30 }],
                                    paintStyle: conn.paintStyle || { stroke: "blue", strokeWidth: 2 }
                                });
                                if (conn.label) {
                                    newConnection.setLabel(conn.label);
                                }
                            } catch (e) {
                                console.error("Error recreating connection:", e);
                            }
                        });
        
                        that.jsPlumb.repaintEverything();
                    }, 500);
                }, 500);
            }, 500);
        },

        _arrangeNodesWithoutConnections: function() {
            var canvasId = this.getId() + "-canvas";
            var canvas = document.getElementById(canvasId);
            var nodes = document.querySelectorAll(".flowNode");
            var numNodes = nodes.length;
            var levelMap = {}; // Store nodes by level (y-position)
            var rootNodes = []; // Nodes with no incoming connections (level 0)
            var that = this;
            
            // Build the connection map
            var connectionMap = {};
            var allNodeIds = new Set();
        
            // Collect all node IDs
            for (let i = 0; i < numNodes; i++) {
                let nodeId = nodes[i].id;
                allNodeIds.add(nodeId);
                connectionMap[nodeId] = []; // Initialize with an empty array
            }
        
            // Populate the connection map based on our stored connections
            if (this._pendingConnections) {
                this._pendingConnections.forEach(function(conn) {
                    let sourceId = conn.source;
                    let targetId = conn.target;
                    if (!connectionMap[sourceId]) {
                        connectionMap[sourceId] = [];
                    }
                    connectionMap[sourceId].push(targetId);
                });
            }
        
            // Identify root nodes (nodes with no incoming connections)
            for (let nodeId of allNodeIds) {
                let isRoot = true;
                for (let sourceId of allNodeIds) {
                    if (sourceId !== nodeId && connectionMap[sourceId] && connectionMap[sourceId].includes(nodeId)) {
                        isRoot = false;
                        break;
                    }
                }
                if (isRoot) {
                    rootNodes.push(nodeId);
                }
            }
        
            // Function to recursively position nodes in a tree layout
            function positionNodes(nodeIds, level) {
                if (!nodeIds || nodeIds.length === 0) {
                    return;
                }
        
                if (!levelMap[level]) {
                    levelMap[level] = [];
                }
        
                nodeIds.forEach(nodeId => {
                    levelMap[level].push(nodeId);
        
                    // Position the node
                    let node = document.getElementById(nodeId);
                    if (node) {
                        let y = level * that._levelHeight + 50; // Vertical spacing
                        node.style.top = y + "px";
                    }
        
                    // Recursively position child nodes
                    if (connectionMap[nodeId]) {
                        positionNodes(connectionMap[nodeId], level + 1);
                    }
                });
            }
        
            // Start positioning from the root nodes
            positionNodes(rootNodes, 0);
        
            // Calculate horizontal positions based on the number of nodes at each level
            for (let level in levelMap) {
                let numNodesAtLevel = levelMap[level].length;
                let startX = (canvas.offsetWidth - (numNodesAtLevel - 1) * that._horizontalSpacing) / 2;
        
                for (let i = 0; i < numNodesAtLevel; i++) {
                    let nodeId = levelMap[level][i];
                    let node = document.getElementById(nodeId);
        
                    if (node) {
                        let x = startX + i * that._horizontalSpacing;
                        node.style.left = x + "px";
        
                        // Save the node's position
                        that._nodePositions[nodeId] = {
                            x: x,
                            y: parseFloat(node.style.top)
                        };
                    }
                }
            }
        },

        // Add this new method that will arrange nodes but preserve connections
        _preserveConnectionsAndArrange: function () {
            var canvasId = this.getId() + "-canvas";
            var canvas = document.getElementById(canvasId);
            var nodes = document.querySelectorAll(".flowNode");
            var that = this;
        
            // Store connections
            var currentConnections = that.jsPlumb.getConnections().map(function(connection) {
                return {
                    sourceId: connection.sourceId,
                    targetId: connection.targetId,
                    paintStyle: connection.getPaintStyle(),
                    connector: connection.getConnector().getOriginalSpec().id,
                    anchors: [
                        connection.endpoints[0].anchor.type,
                        connection.endpoints[1].anchor.type
                    ],
                    label: connection.getLabel ? connection.getLabel() : ""
                };
            });
        
            // Delete connections
            that.jsPlumb.deleteEveryConnection();
        
            // Arrange nodes
            that._arrangeNodesWithoutConnections();
        
            setTimeout(function() {
                // Recreate connections
                currentConnections.forEach(function(conn) {
                    try {
                        var newConnection = that.jsPlumb.connect({
                            source: conn.sourceId,
                            target: conn.targetId,
                            anchors: [conn.anchors[0], conn.anchors[1]],
                            connector: ["Bezier", { curviness: 50, stub: 30 }],
                            paintStyle: conn.paintStyle || { stroke: "blue", strokeWidth: 2 }
                        });
                        if (conn.label) {
                            newConnection.setLabel(conn.label);
                        }
                    } catch (e) {
                        console.error("Error recreating connection:", e);
                    }
                });
        
                that.fixEndpointRendering();
                that.jsPlumb.repaintEverything();
            }, 500);
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
                            connector: ["Bezier", { curviness: 50, stub: 30 }],
                            zIndex: 10 // Ensure zIndex is set during endpoint creation
                        });
                    });
                }
            });
        
            // Update connections and repaint everything
            that.jsPlumb.repaintEverything();
        },

        // Updated addNode method with improved endpoint handling
        addNode: function (x, y, id, label) {
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
            removeButton.addEventListener("click", function (event) {
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
                stop: function (event) {
                    that._nodePositions[nodeId] = {
                        x: parseInt(nodeEl.style.left),
                        y: parseInt(nodeEl.style.top)
                    };
                    that.jsPlumb.repaintEverything();
                }
            });
        
            setTimeout(function () {
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
                    connector: ["Bezier", { curviness: 50, stub: 30 }]
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

        autoArrangeNodes: function () {
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
        
            // Store complete connection data
            var connectionData = this.jsPlumb.getAllConnections().map(function(conn) {
                return {
                    sourceId: conn.sourceId,
                    targetId: conn.targetId,
                    paintStyle: conn.getPaintStyle(),
                    hoverPaintStyle: conn.getHoverPaintStyle(),
                    overlays: Array.isArray(conn.getOverlays()) ? conn.getOverlays().map(overlay => overlay.getOptions()) : [],
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
        
            // Layout parameters
            const NODE_SPACING_X = 120;
            const NODE_SPACING_Y = 100;
            const START_Y = 50;
        
            // Calculate total width for centering
            function calculateLayout(node, startX, level) {
                node.x = startX;
                node.y = START_Y + (level * NODE_SPACING_Y);
        
                let childrenWidth = 0;
                node.children.forEach(child => {
                    childrenWidth += calculateLayout(child, startX + childrenWidth, level + 1);
                });
        
                const nodeWidth = Math.max(node.width, childrenWidth);
                return nodeWidth + NODE_SPACING_X;
            }
        
            // Centering logic
            let totalWidth = 0;
            rootNodes.forEach(root => {
                totalWidth += calculateLayout(root, 0, 0);
            });
        
            // Calculate starting position to center nodes
            let centerX = (canvas.offsetWidth - totalWidth) / 2;
        
            // Position root nodes
            rootNodes.forEach(root => {
                calculateLayout(root, centerX, 0);
            });
        
            // Apply positions to DOM
            Object.values(nodeMap).forEach(node => {
                node.element.style.position = 'absolute';
                node.element.style.left = node.x + 'px';
                node.element.style.top = node.y + 'px';
            });
        
            // Recreate connections after DOM update
            setTimeout(() => {
                connectionData.forEach(conn => {
                    try {
                        that.jsPlumb.connect({
                            source: conn.sourceId,
                            target: conn.targetId,
                            paintStyle: conn.paintStyle,
                            hoverPaintStyle: conn.hoverPaintStyle,
                            anchors: conn.anchors,
                            overlays: Array.isArray(conn.overlays) ? conn.overlays.map(overlay => 
                                ["Label", { 
                                    label: overlay.label,
                                    location: overlay.location,
                                    cssClass: overlay.cssClass
                                }]
                            ) : []
                        });
                    } catch (e) {
                        console.error("Error recreating connection:", e);
                    }
                });
        
                // Force redraw of all elements
                that.jsPlumb.repaintEverything();
                console.log("Auto-arrange completed with", connectionData.length, "connections restored");
            }, 300);
        
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
        },

        // Add method to manually delete a connection
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
