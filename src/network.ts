import { Network, DataSet, Node, Edge } from 'vis-network';

export interface AnimalData {
    genus: string;
    species: string;
    eats: string[];
    eatenBy: string[];
}

export class FoodChainNetwork {
    private nodes: DataSet<Node>;
    private edges: DataSet<Edge>;
    private network: Network;

    constructor(container: HTMLElement) {
        this.nodes = new DataSet<Node>();
        this.edges = new DataSet<Edge>();

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

        this.network = new Network(container, data, options);
    }

    addAnimal(animal: AnimalData) {
        const label = `${animal.genus} ${animal.species}`;
        
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
}
