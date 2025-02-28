sap.ui.define([
    "sap/ui/core/Control",
    "sap/m/Dialog",
    "sap/m/Input",
    "sap/m/TextArea",
    "sap/m/Button",
    "sap/m/Label",
    "sap/ui/layout/form/SimpleForm"
], function(Control, Dialog, Input, TextArea, Button, Label, SimpleForm) {
    "use strict";

    return Control.extend("ui5.flowdesigner.control.Paths", {
        metadata: {
            properties: {
                width: { type: "sap.ui.core.CSSSize", defaultValue: "100%" },
                height: { type: "sap.ui.core.CSSSize", defaultValue: "600px" }
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
            this._currentScale = 1; // Initialize zoom scale
            this._minScale = 0.2; // Minimum zoom scale
            this._maxScale = 15; // Maximum zoom scale
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

            // "Add Node" button stays in top-right corner
            oRm.write("<div class='flowToolbar'>");
            oRm.renderControl(new sap.m.Button({
                text: "Add Node",
                press: function() {
                    oControl.addNode();
                }
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
            this.jsPlumb = jsPlumb.getInstance({
                Endpoint: ["Dot", { radius: 6 }],
                Connector: ["Bezier", { curviness: 50 }],
                HoverPaintStyle: { stroke: "#1e8151", strokeWidth: 3 },
                ConnectionOverlays: [
                    ["Arrow", {
                        location: 1,
                        id: "arrow",
                        width: 12,
                        length: 12
                    }],
                    ["Custom", {
                        create: function(component) { // 'component' is the connection
                            var wrapper = document.createElement("div");
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
                        id: "customOverlay"
                    }]
                ],
                Container: canvasId
            });

            this.jsPlumb.draggable(document.querySelectorAll(".flowNode"), {
                containment: canvasId
            });

            // Store the "that" context for use inside the event listener
            var that = this;

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

        addNode: function(x, y) {
            var canvasId = this.getId() + "-canvas";
            var canvas = document.getElementById(canvasId);
            var nodeId = "node" + (++this._nodeCounter);

            // Default position if not specified
            if (!x) x = 100 + Math.floor(Math.random() * 400);
            if (!y) y = 50 + Math.floor(Math.random() * 300);

            // Create node element
            var nodeEl = document.createElement("div");
            nodeEl.id = nodeId;
            nodeEl.className = "flowNode";
            nodeEl.innerHTML = "JC " + this._nodeCounter;
            nodeEl.style.left = x + "px";
            nodeEl.style.top = y + "px";
            canvas.appendChild(nodeEl);

            // Make the node draggable
            this.jsPlumb.draggable(nodeEl, {
                containment: canvasId
            });

            // Add a SOURCE endpoint (at the bottom)
            this.jsPlumb.addEndpoint(nodeId, {
                anchor: "Bottom",
                isSource: true,
                isTarget: false, // IMPORTANT: Only a source
                endpoint: ["Dot", { radius: 6 }],
                paintStyle: { fill: "#FF6666", stroke: "#FF4D4D", strokeWidth: 2 },
                connector: ["Flowchart", { stub: 30, gap: 0, cornerRadius: 5, alwaysRespectStubs: true }],
                maxConnections: -1 // Allow unlimited connections from this source
            });

            // Add a TARGET endpoint (at the top)
            this.jsPlumb.addEndpoint(nodeId, {
                anchor: "Top",
                isSource: false, // IMPORTANT: Only a target
                isTarget: true,
                endpoint: ["Dot", { radius: 6 }],
                paintStyle: { fill: "#6699FF", stroke: "#4D88FF", strokeWidth: 2 },
                maxConnections: -1 // Allow unlimited connections to this target
            });

            // Fire event
            this.fireNodeAdded({
                nodeId: nodeId
            });

            return nodeId;
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
                                    connection._label = oEvent.getParameter("newValue");
                                }
                            })
                        ]
                    })
                ],
                buttons: [
                    new Button({
                        text: "OK",
                        press: function() {
                            // Get label value from the input field

                             // Access the label input field
                            var labelInput = oDialog.getContent()[0].getContent()[1];

                            var labelValue = labelInput.getValue();

                            // Set the label
                            connection.setLabel(labelValue);

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
        }
    });
});
