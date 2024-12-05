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
