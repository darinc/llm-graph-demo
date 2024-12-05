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
                        input.value = node.label;
                        submitBtn.click();
                    }
                }
            }
        });
    }

    addAnimal(animal: AnimalData) {
        const label = animal.commonName;
        
        // Add node if it doesn't exist
        if (!this.nodes.get(label)) {
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

    public debug() {
        console.log({
            nodes: this.nodes.get(),
            edges: this.edges.get(),
            network: this.network
        });
    }
}
