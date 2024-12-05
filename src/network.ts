declare const vis: any;

// Helper function for standardizing animal names
function standardizeAnimalName(name: string): string {
    // Common irregular plurals
    const irregularPlurals: { [key: string]: string } = {
        'mouse': 'mice',
        'goose': 'geese',
        'deer': 'deer',
        'sheep': 'sheep',
        'fish': 'fish',
        'moose': 'moose',
        'wolf': 'wolves',
        'calf': 'calves',
        'leaf': 'leaves',
    };

    name = name.toLowerCase().trim();

    // Check for irregular plurals first
    if (irregularPlurals[name]) {
        return irregularPlurals[name];
    }

    // If it's already plural, return as is
    if (name.endsWith('s')) {
        return name;
    }

    // Regular pluralization
    if (name.endsWith('y')) {
        return name.slice(0, -1) + 'ies';
    } else {
        return name + 's';
    }
}

interface Node {
    id: string;
    label: string;
}

interface Edge {
    from: string;
    to: string;
    label: string;
}

interface PlaceholderData {
    commonName: string;
    note: string;
    eats?: string[];
    eatenBy?: string[];
}

export function standardizeAnimalName(name: string): string {
    // Common irregular plurals
    const irregularPlurals: { [key: string]: string } = {
        'mouse': 'mice',
        'goose': 'geese',
        'deer': 'deer',
        'sheep': 'sheep',
        'fish': 'fish',
        'moose': 'moose',
        'wolf': 'wolves',
        'calf': 'calves',
        'leaf': 'leaves',
    };

    name = name.toLowerCase().trim();

    // Check for irregular plurals first
    if (irregularPlurals[name]) {
        return irregularPlurals[name];
    }

    // If it's already plural, return as is
    if (name.endsWith('s')) {
        return name;
    }

    // Regular pluralization
    if (name.endsWith('y')) {
        return name.slice(0, -1) + 'ies';
    } else {
        return name + 's';
    }
}

export interface AnimalData {
    genus: string;
    species: string;
    commonName: string;
    eats: string[];
    eatenBy: string[];
    size: number;     // Size in meters (length or height)
    diet: 'herbivore' | 'carnivore' | 'omnivore' | 'insectivore';
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
                },
                scaling: {
                    min: 20,
                    max: 50
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
                    const animalData = (window as any).lastAnimalData?.[node.label.toLowerCase()];
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
                        (window as any).nodeToReplace = node.label.toLowerCase();
                        input.value = node.label.toLowerCase();
                        // Log the double-click action
                        const logEntry = document.getElementById('log-entries');
                        if (logEntry) {
                            const entry = document.createElement('div');
                            entry.className = 'log-entry input';
                            const timestamp = new Date().toLocaleTimeString();
                            entry.textContent = `[${timestamp}] User requested animal via double-click: ${node.label}`;
                            logEntry.appendChild(entry);
                            logEntry.scrollTop = logEntry.scrollHeight;
                        }
                        submitBtn.click();
                    }
                }
            }
        });
    }

    addAnimal(animal: AnimalData) {
        // Standardize the common name
        const label = standardizeAnimalName(animal.commonName);
        animal.commonName = label;  // Update the stored data
        
        // Standardize the prey and predator names
        animal.eats = animal.eats.map(prey => standardizeAnimalName(prey));
        animal.eatenBy = animal.eatenBy.map(predator => standardizeAnimalName(predator));
        
        // Define colors for each diet type
        const dietColors = {
            herbivore: '#4CAF50',  // Green
            carnivore: '#f44336',  // Red
            omnivore: '#FF9800',   // Orange
            insectivore: '#AC57F0' // Purple
        };

        // Calculate node size (min 20, max 50)
        const baseSize = 20;
        const maxSize = 50;
        const sizeScale = Math.min(Math.max(animal.size * 10, baseSize), maxSize);
        
        // Check if this animal might be a more specific version of an existing node
        const existingNodes = this.nodes.get({
            filter: node => node.label.toLowerCase().includes(label) || 
                          label.includes(node.label.toLowerCase())
        });

        if (existingNodes.length > 0) {
            // Update the existing node with the new label and properties
            this.nodes.remove(existingNodes[0].label);
            this.nodes.add({
                id: label,
                label: label,
                color: dietColors[animal.diet],
                size: sizeScale
            });
        } else if (!this.nodes.get(label)) {
            // Add new node if it doesn't exist
            this.nodes.add({
                id: label,
                label: label,
                color: dietColors[animal.diet],
                size: sizeScale
            });
        }

        // When adding placeholder nodes, use neutral color and minimum size
        const addPlaceholderNode = (nodeId: string, relationship: 'eats' | 'eatenBy', sourceNode: string) => {
            if (!this.nodes.get(nodeId)) {
                // Standardize the node ID
                nodeId = standardizeAnimalName(nodeId);
                
                // Initialize the placeholder data with empty arrays
                const placeholderData: PlaceholderData = {
                    commonName: nodeId,
                    note: "This node was created as a reference from another animal's relationships",
                    eats: [],      // Initialize empty array
                    eatenBy: []    // Initialize empty array
                };

                // Add the specific relationship
                if (relationship === 'eats') {
                    placeholderData.eats = [sourceNode];
                } else {
                    placeholderData.eatenBy = [sourceNode];
                }

                // Store the placeholder data
                (window as any).lastAnimalData[nodeId] = placeholderData;

                this.nodes.add({
                    id: nodeId,
                    label: nodeId,
                    color: '#848484',  // Gray for unknown diet
                    size: baseSize,    // Minimum size for unknown animals
                    placeholder: true  // Add this flag
                });

                // Add the relationship edge
                if (relationship === 'eats') {
                    if (!this.edges.get({
                        filter: edge => edge.from === nodeId && edge.to === sourceNode
                    }).length) {
                        this.edges.add({
                            from: nodeId,
                            to: sourceNode,
                            label: 'eats'
                        });
                    }
                } else {
                    if (!this.edges.get({
                        filter: edge => edge.from === sourceNode && edge.to === nodeId
                    }).length) {
                        this.edges.add({
                            from: sourceNode,
                            to: nodeId,
                            label: 'eats'
                        });
                    }
                }
            } else {
                // Node exists, ensure the data structure exists and has arrays
                const existingData = (window as any).lastAnimalData[nodeId] as PlaceholderData;
                if (!existingData) {
                    (window as any).lastAnimalData[nodeId] = {
                        commonName: nodeId,
                        note: "This node was created as a reference from another animal's relationships",
                        eats: [],
                        eatenBy: []
                    };
                } else {
                    // Ensure arrays exist
                    existingData.eats = existingData.eats || [];
                    existingData.eatenBy = existingData.eatenBy || [];
                }

                // Update the relationships
                if (relationship === 'eats') {
                    if (!existingData.eats.includes(sourceNode)) {
                        existingData.eats.push(sourceNode);
                    }
                } else {
                    if (!existingData.eatenBy.includes(sourceNode)) {
                        existingData.eatenBy.push(sourceNode);
                    }
                }
            }
        };

        // Add edges for what it eats
        animal.eats.forEach(prey => {
            addPlaceholderNode(prey, 'eatenBy', label);
            if (!this.edges.get({
                filter: edge => edge.from === label && edge.to === prey
            }).length) {
                this.edges.add({
                    from: label,
                    to: prey,
                    label: 'eats'
                });
            }
        });

        // Add edges for what eats it
        animal.eatenBy.forEach(predator => {
            // Create placeholder nodes for predators if they don't exist
            addPlaceholderNode(predator, 'eats', label);
            if (!this.edges.get({
                filter: edge => edge.from === predator && edge.to === label
            }).length) {
                this.edges.add({
                    from: predator,
                    to: label,
                    label: 'eats'
                });
            }
        });
    }

    public clear() {
        this.nodes.clear();
        this.edges.clear();
    }

    public updateNodeAndNeighbors(oldName: string, newName: string) {
        // Get the animal data first since we need it for styling
        const animalData = (window as any).lastAnimalData[newName];
        
        // Define colors for each diet type
        const dietColors = {
            herbivore: '#4CAF50',  // Green
            carnivore: '#f44336',  // Red
            omnivore: '#FF9800',   // Orange
            insectivore: '#9C27B0' // Purple
        };

        // Calculate node size
        const baseSize = 20;
        const maxSize = 50;
        const sizeScale = Math.min(Math.max(animalData.size * 10, baseSize), maxSize);

        // Get all edges connected to this node
        const edges = this.edges.get({
            filter: edge => edge.from === oldName || edge.to === oldName
        });

        // Update the node itself with proper styling
        const node = this.nodes.get(oldName);
        if (node) {
            this.nodes.remove(oldName);
            this.nodes.add({
                id: newName,
                label: newName,
                color: dietColors[animalData.diet],
                size: sizeScale
            });

            // Update all connected edges
            edges.forEach(edge => {
                this.edges.remove(edge.id);
                this.edges.add({
                    from: edge.from === oldName ? newName : edge.from,
                    to: edge.to === oldName ? newName : edge.to,
                    label: edge.label
                });
            });
        }

        if (animalData) {
            // Add placeholder nodes for new relationships with proper styling
            const addPlaceholderNode = (nodeId: string) => {
                if (!this.nodes.get(nodeId)) {
                    this.nodes.add({
                        id: nodeId,
                        label: nodeId,
                        color: '#848484',  // Gray for unknown diet
                        size: baseSize     // Minimum size for unknown animals
                    });
                }
            };

            // Add new relationships
            animalData.eats.forEach(prey => {
                addPlaceholderNode(prey);
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
                addPlaceholderNode(predator);
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

    public getPlaceholderNodes(): string[] {
        const nodes = this.nodes.get({
            filter: node => (node as any).placeholder === true
        });
        return nodes.map(node => node.label);
    }

    public getNetworkStats() {
        const nodes = this.nodes.get();
        const edges = this.edges.get();
        
        // Calculate node statistics
        const totalNodes = nodes.length;
        const placeholderNodes = nodes.filter(node => (node as any).placeholder).length;
        const completeNodes = totalNodes - placeholderNodes;
        
        // Calculate edge statistics
        const totalEdges = edges.length;
        
        // Calculate connection counts per node
        const connectionCounts = new Map<string, number>();
        nodes.forEach(node => {
            const connected = edges.filter(edge => 
                edge.from === node.id || edge.to === node.id
            ).length;
            connectionCounts.set(node.id, connected);
        });
        
        // Find most connected node
        let mostConnected = {node: '', count: 0};
        connectionCounts.forEach((count, node) => {
            if (count > mostConnected.count) {
                mostConnected = {node, count};
            }
        });
        
        // Calculate average connections
        const avgConnections = totalNodes > 0 
            ? (totalEdges * 2 / totalNodes).toFixed(1) 
            : '0';
        
        return {
            nodes: {
                total: totalNodes,
                placeholders: placeholderNodes,
                complete: completeNodes
            },
            edges: {
                total: totalEdges,
                mostConnected: mostConnected.count > 0 
                    ? `${mostConnected.node} (${mostConnected.count})` 
                    : '-',
                avgConnections
            }
        };
    }
}
