sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel"
], function(Controller, MessageToast, JSONModel) {
    "use strict";

    return Controller.extend("ui5.flowdesigner.controller.Paths", {
        onInit: function() {
            this._nodes = {};
            this._connections = [];

            // Create a JSON model for the view
            var oViewModel = new JSONModel({
                nodeCount: 0
            });
            this.getView().setModel(oViewModel, "viewModel");
            this._lastNodePosition = { x: 100, y: 100 }; // Initial position
        },

        onNodeAdded: function(oEvent) {
            var nodeId = oEvent.getParameter("nodeId");
            this._nodes[nodeId] = {
                id: nodeId,
                outConnections: [],
                inConnections: []
            };

            MessageToast.show("Node added: " + nodeId);

            // Update the node count
            this._updateNodeCount();
        },

        onConnectionCreated: function(oEvent) {
            var connectionInfo = oEvent.getParameter("connection");
            var sourceId = connectionInfo.sourceId;
            var targetId = connectionInfo.targetId;

            // Store connection reference
            var connection = {
                id: "conn_" + sourceId + "_" + targetId,
                source: sourceId,
                target: targetId,
                jsPlumbConnection: connectionInfo.connection
            };

            this._connections.push(connection);

            // Update node connection references
            if (this._nodes[sourceId]) {
                this._nodes[sourceId].outConnections.push(connection.id);
            }

            if (this._nodes[targetId]) {
                this._nodes[targetId].inConnections.push(connection.id);
            }

            MessageToast.show("Connection created from " + sourceId + " to " + targetId);

            // You could open a dialog here to add more info to the connection
            this._showConnectionDialog(connection);
        },

        onConnectionRemoved: function(oEvent) {
            var connectionInfo = oEvent.getParameter("connection");
            var sourceId = connectionInfo.sourceId;
            var targetId = connectionInfo.targetId;
            var connectionId = "conn_" + sourceId + "_" + targetId;

            // Remove connection from array
            this._connections = this._connections.filter(function(conn) {
                return conn.id !== connectionId;
            });

            // Remove connection references from nodes
            if (this._nodes[sourceId]) {
                this._nodes[sourceId].outConnections = this._nodes[sourceId].outConnections.filter(function(connId) {
                    return connId !== connectionId;
                });
            }

            if (this._nodes[targetId]) {
                this._nodes[targetId].inConnections = this._nodes[targetId].inConnections.filter(function(connId) {
                    return connId !== connectionId;
                });
            }

            MessageToast.show("Connection removed");
        },

        _showConnectionDialog: function(connection) {
            if (!this._oConnectionDialog) {
                this._oConnectionDialog = new sap.m.Dialog({
                    title: "Connection Properties",
                    content: [
                        new sap.m.Input({
                            placeholder: "Connection Label",
                            id: "connectionLabel"
                        }),
                        new sap.m.Select({
                            id: "connectionType",
                            items: [
                                new sap.ui.core.Item({ key: "default", text: "Default" }),
                                new sap.ui.core.Item({ key: "success", text: "Success Path" }),
                                new sap.ui.core.Item({ key: "error", text: "Error Path" })
                            ]
                        })
                    ],
                    beginButton: new sap.m.Button({
                        text: "Save",
                        press: function() {
                            var label = sap.ui.getCore().byId("connectionLabel").getValue();
                            var type = sap.ui.getCore().byId("connectionType").getSelectedKey();

                            // Update connection
                            if (this._currentConnection) {
                                this._currentConnection.label = label;
                                this._currentConnection.type = type;

                                // Update visual appearance based on type
                                var strokeColor = "#5DADE2"; // default color

                                if (type === "success") {
                                    strokeColor = "#58D68D";
                                } else if (type === "error") {
                                    strokeColor = "#EC7063";
                                }

                                this._currentConnection.jsPlumbConnection.setPaintStyle({
                                    stroke: strokeColor,
                                    strokeWidth: 2
                                });

                                // Add or update label
                                var existingLabel = this._currentConnection.jsPlumbConnection.getOverlay("label");

                                if (existingLabel) {
                                    existingLabel.setLabel(label);
                                } else if (label) {
                                    this._currentConnection.jsPlumbConnection.addOverlay([
                                        "Label", {
                                            label: label,
                                            id: "label",
                                            cssClass: "connectionLabel"
                                        }
                                    ]);
                                }
                            }

                            this._oConnectionDialog.close();
                        }.bind(this)
                    }),
                    endButton: new sap.m.Button({
                        text: "Cancel",
                        press: function() {
                            this._oConnectionDialog.close();
                        }.bind(this)
                    })
                });
            }

            // Store current connection being edited
            this._currentConnection = connection;

            // Reset input fields
            sap.ui.getCore().byId("connectionLabel").setValue("");
            sap.ui.getCore().byId("connectionType").setSelectedKey("default");

            this._oConnectionDialog.open();
        },

        // Method to get the current flow design as JSON
        getFlowDesign: function() {
            return {
                nodes: this._nodes,
                connections: this._connections
            };
        },

        // Helper function to update the node count in the model
        _updateNodeCount: function() {
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/nodeCount", Object.keys(this._nodes).length);
        }
    });
});