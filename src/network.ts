declare const vis: any;

interface Node {
    id: string;
    label: string;
}

interface Edge {
    from: string;
    to: string;
    label: string;
}

export interface AnimalData {
    genus: string;
    species: string;
    commonName: string;
    eats: string[];
    eatenBy: string[];
}

export class FoodChainNetwork {
    private nodes: DataSet<Node>;
    private edges: DataSet<Edge>;
    private network: any;

    private updateNodeLabel(oldLabel: string, newLabel: string) {
        // Update the node ID and label
        const node = this.nodes.get(oldLabel);
        if (node) {
            this.nodes.remove(oldLabel);
            this.nodes.add({
                id: newLabel,
                label: newLabel
            });

            // Update all connected edges
            const edges = this.edges.get({
                filter: edge => edge.from === oldLabel || edge.to === oldLabel
            });

            edges.forEach(edge => {
                this.edges.remove(edge.id);
                this.edges.add({
                    from: edge.from === oldLabel ? newLabel : edge.from,
                    to: edge.to === oldLabel ? newLabel : edge.to,
                    label: edge.label
                });
            });
        }
    }

    constructor(container: HTMLElement) {
        this.nodes = new vis.DataSet();
        this.edges = new vis.DataSet();

        const data = {
            nodes: this.nodes,
            edges: this.edges
        };

        const options = {
            nodes: {
                shape: 'circle',
                font: {
                    size: 20
                }
            },
            edges: {
                arrows: 'to',
                color: {
                    color: '#848484'
                }
            }
        };

        this.network = new vis.Network(container, data, options);

        // Add single-click event handler
        this.network.on('click', (params: any) => {
            const jsonDisplay = document.getElementById('json-display');
            const jsonContent = document.getElementById('json-content');
            if (!jsonDisplay || !jsonContent) return;

            // Check if a node was clicked
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                const node = this.nodes.get(nodeId);
                if (node) {
                    // Get the stored data from the global object
                    const animalData = (window as any).lastAnimalData?.[node.label];
                    if (animalData) {
                        jsonDisplay.style.display = 'block';
                        jsonContent.textContent = JSON.stringify(animalData, null, 2);
                    } else {
                        jsonDisplay.style.display = 'block';
                        jsonContent.textContent = JSON.stringify({
                            commonName: node.label,
                            note: "This node was created as a reference from another animal's relationships"
                        }, null, 2);
                    }
                }
            } else {
                // Clicked elsewhere, hide the display
                jsonDisplay.style.display = 'none';
            }
        });

        // Add double-click event handler
        this.network.on('doubleClick', async (params: any) => {
            // Check if a node was clicked
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                const node = this.nodes.get(nodeId);
                if (node) {
                    // Find and trigger the input and submit elements
                    const input = document.getElementById('animal-input') as HTMLInputElement;
                    const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
                    if (input && submitBtn) {
                        // Store the node to replace
                        (window as any).nodeToReplace = node.label;
                        input.value = node.label;
                        submitBtn.click();
                    }
                }
            }
        });
    }

    addAnimal(animal: AnimalData) {
        const label = animal.commonName;
        
        // Check if this animal might be a more specific version of an existing node
        const existingNodes = this.nodes.get({
            filter: node => node.label.toLowerCase().includes(label.toLowerCase()) || 
                          label.toLowerCase().includes(node.label.toLowerCase())
        });

        if (existingNodes.length > 0) {
            // Update the existing node with the new label
            this.updateNodeLabel(existingNodes[0].label, label);
        } else if (!this.nodes.get(label)) {
            // Add new node if it doesn't exist
            this.nodes.add({
                id: label,
                label: label
            });
        }

        // Add edges for what it eats
        animal.eats.forEach(prey => {
            if (!this.nodes.get(prey)) {
                this.nodes.add({
                    id: prey,
                    label: prey
                });
            }
            this.edges.add({
                from: label,
                to: prey,
                label: 'eats'
            });
        });

        // Add edges for what eats it
        animal.eatenBy.forEach(predator => {
            if (!this.nodes.get(predator)) {
                this.nodes.add({
                    id: predator,
                    label: predator
                });
            }
            this.edges.add({
                from: predator,
                to: label,
                label: 'eats'
            });
        });
    }

    public clear() {
        this.nodes.clear();
        this.edges.clear();
    }

    public updateNodeAndNeighbors(oldName: string, newName: string) {
        // Get all edges connected to this node
        const edges = this.edges.get({
            filter: edge => edge.from === oldName || edge.to === oldName
        });

        // Update the node itself
        this.updateNodeLabel(oldName, newName);

        // Update all connected edges
        edges.forEach(edge => {
            this.edges.remove(edge.id);
            this.edges.add({
                from: edge.from === oldName ? newName : edge.from,
                to: edge.to === oldName ? newName : edge.to,
                label: edge.label
            });
        });

        // Get the animal data
        const animalData = (window as any).lastAnimalData[newName];
        if (animalData) {
            // Add placeholder nodes for new relationships
            animalData.eats.forEach(prey => {
                if (!this.nodes.get(prey)) {
                    this.nodes.add({
                        id: prey,
                        label: prey
                    });
                }
                // Add edge if it doesn't exist
                if (!this.edges.get({
                    filter: edge => edge.from === newName && edge.to === prey
                }).length) {
                    this.edges.add({
                        from: newName,
                        to: prey,
                        label: 'eats'
                    });
                }
            });

            animalData.eatenBy.forEach(predator => {
                if (!this.nodes.get(predator)) {
                    this.nodes.add({
                        id: predator,
                        label: predator
                    });
                }
                // Add edge if it doesn't exist
                if (!this.edges.get({
                    filter: edge => edge.from === predator && edge.to === newName
                }).length) {
                    this.edges.add({
                        from: predator,
                        to: newName,
                        label: 'eats'
                    });
                }
            });
        }
    }

    public debug() {
        console.log({
            nodes: this.nodes.get(),
            edges: this.edges.get(),
            network: this.network
        });
    }
}
