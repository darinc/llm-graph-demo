import * as webllm from "@mlc-ai/web-llm";
import { FoodChainNetwork, AnimalData, standardizeAnimalName } from './network';

function mergeRelationships(
    animalData: AnimalData,
    network: FoodChainNetwork,
    animalName: string
): AnimalData {
    // Get all edges connected to this node
    const edges = network.edges.get({
        filter: (edge: any) => edge.from === animalName || edge.to === animalName
    });

    // Create sets to avoid duplicates
    const eatsSet = new Set(animalData.eats);
    const eatenBySet = new Set(animalData.eatenBy);

    // Add existing relationships from the network
    edges.forEach((edge: any) => {
        if (edge.from === animalName) {
            eatsSet.add(edge.to);
        } else if (edge.to === animalName) {
            eatenBySet.add(edge.from);
        }
    });

    // Update the animalData with merged relationships
    return {
        ...animalData,
        eats: Array.from(eatsSet),
        eatenBy: Array.from(eatenBySet)
    };
}

let nodeToReplace: string | null = null;
let lastAnimalData: { [key: string]: AnimalData } = {};
let autoCompleteRunning = false;
(window as any).lastAnimalData = lastAnimalData;

function setLabel(id: string, text: string) {
    const label = document.getElementById(id);
    if (label == null) {
        throw Error("Cannot find label " + id);
    }
    label.innerText = text;
}

async function extractJsonFromResponse(text: string): Promise<AnimalData> {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    const data = JSON.parse(jsonMatch[0]);
    
    // Convert all strings to lowercase
    return {
        genus: data.genus.toLowerCase(),
        species: data.species.toLowerCase(),
        commonName: standardizeAnimalName(data.commonName),
        eats: data.eats.map((item: string) => standardizeAnimalName(item)),
        eatenBy: data.eatenBy.map((item: string) => standardizeAnimalName(item)),
        size: Number(data.size),
        diet: data.diet.toLowerCase() as 'herbivore' | 'carnivore' | 'omnivore'
    };
}

async function main() {
    const initProgressCallback = (report: webllm.InitProgressReport) => {
        setLabel("init-label", report.text);
    };

    const selectedModel = "Llama-3.2-3B-Instruct-q4f16_1-MLC";
    const engine: webllm.MLCEngineInterface = await webllm.CreateMLCEngine(
        selectedModel,
        { initProgressCallback: initProgressCallback },
    );

    // Initialize network
    const networkContainer = document.getElementById('mynetwork');
    if (!networkContainer) throw new Error("Network container not found");
    const network = new FoodChainNetwork(networkContainer);
    (window as any).foodChainNetwork = network;

    // Setup input handling
    const input = document.getElementById('animal-input') as HTMLInputElement;
    const submitBtn = document.getElementById('submit-btn');
    if (!input || !submitBtn) throw new Error("UI elements not found");

    input.addEventListener('keypress', async (event) => {
        if (event.key === 'Enter') {
            submitBtn.click();  // Trigger the click event on the submit button
        }
    });

    // Add random animal button handler
    const randomBtn = document.getElementById('random-btn');
    const clearBtn = document.getElementById('clear-btn');
    if (!randomBtn || !clearBtn) throw new Error("Buttons not found");

    // List of common animals for random selection
    const randomAnimals = [
        "lion", "zebra", "elephant", "giraffe", "penguin", 
        "shark", "eagle", "snake", "rabbit", "deer",
        "wolf", "bear", "fox", "owl", "mouse",
        "hawk", "salmon", "seal", "octopus", "butterfly"
    ];

    randomBtn.addEventListener('click', () => {
        // Select a random animal from the list
        const randomIndex = Math.floor(Math.random() * randomAnimals.length);
        const randomAnimal = randomAnimals[randomIndex];
        
        // Set the input value and trigger the submit button
        input.value = randomAnimal;
        submitBtn.click();
    });

    // Add clear button handler
    clearBtn.addEventListener('click', () => {
        network.clear();
        lastAnimalData = {};
        updateNetworkStats(network);
        (window as any).lastAnimalData = lastAnimalData;
        const jsonDisplay = document.getElementById('json-display');
        if (jsonDisplay) {
            jsonDisplay.style.display = 'none';
        }
    });

    const autoBtn = document.getElementById('auto-btn');
    if (!autoBtn) throw new Error("Auto button not found");

    autoBtn.addEventListener('click', () => {
        toggleAutomatic(network, input, submitBtn, autoBtn as HTMLButtonElement);
    });

    submitBtn.addEventListener('click', async () => {
        const animal = standardizeAnimalName(input.value.trim());
        if (!animal) return;

        // Get spinner element
        const spinner = document.getElementById('loading-spinner');
        if (!spinner) throw new Error("Spinner not found");

        // Show loading state
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;
        spinner.style.display = 'inline-block';
        input.classList.add('loading');

        let contextPrompt = `Provide information about ${animal}`;

        // Check if this is a placeholder node being replaced
        const existingData = (window as any).lastAnimalData[animal];
        if (existingData && existingData.note) { // This indicates it's a placeholder
            if (existingData.eats && existingData.eats.length > 0) {
                contextPrompt += `. We know this animal eats: [${existingData.eats.join(', ')}]`;
            }
            if (existingData.eatenBy && existingData.eatenBy.length > 0) {
                contextPrompt += `. We know this animal is eaten by: [${existingData.eatenBy.join(', ')}]`;
            }
            contextPrompt += `. Please maintain these known relationships in your response while adding any additional relationships you know of.`;
        } else {
            // Get existing relationships from the network (for non-placeholder nodes)
            const edges = network.edges.get({
                filter: (edge: any) => edge.from === animal || edge.to === animal
            });

            // Build lists of current relationships
            const currentlyEats: string[] = [];
            const currentlyEatenBy: string[] = [];

            edges.forEach((edge: any) => {
                if (edge.from === animal) {
                    currentlyEats.push(edge.to);
                } else {
                    currentlyEatenBy.push(edge.from);
                }
            });

            // Add relationship context to the prompt
            if (currentlyEats.length > 0 || currentlyEatenBy.length > 0) {
                contextPrompt += `. Current known relationships - This animal eats: [${currentlyEats.join(', ')}]. `;
                contextPrompt += `This animal is eaten by: [${currentlyEatenBy.join(', ')}]. `;
                contextPrompt += `Please maintain these relationships in your response while adding any additional relationships you know of.`;
            }
        }

        const request: webllm.ChatCompletionRequest = {
            stream: false,
            messages: [
                {
                    role: "system",
                    content: "You are a biology expert. Respond only with JSON containing genus, species, common name, what the animal eats (prey), what eats it (predators), size (in meters), and diet type. Use common names for the eats and eatenBy arrays. Use lowercase for all text. For diet, use only 'herbivore', 'carnivore', or 'omnivore'. For size, provide the typical length or height in meters as a number."
                },
                {
                    role: "user",
                    content: `${contextPrompt} in this JSON format: {"genus": "", "species": "", "commonName": "", "eats": [], "eatenBy": [], "size": 0, "diet": ""}`
                }
            ],
            max_tokens: 256,
            response_format: { type: "json_object" } as webllm.ResponseFormat,
        };

        try {
            const reply = await engine.chatCompletion(request);
            const message = await engine.getMessage();
            let animalData = await extractJsonFromResponse(message);
            
            // Merge with existing relationships
            animalData = mergeRelationships(animalData, network, animal);

            // If we have a nodeToReplace, use that instead of searching
            if ((window as any).nodeToReplace) {
                const oldName = (window as any).nodeToReplace;
                // Remove the old entry
                delete lastAnimalData[oldName];
                // Add the new data
                lastAnimalData[animalData.commonName] = animalData;
                network.updateNodeAndNeighbors(oldName, animalData.commonName);
                (window as any).nodeToReplace = null; // Clear the replacement flag
            } else {
                // Existing logic for new nodes
                const existingNodes = Object.keys(lastAnimalData).filter(key => 
                    key.toLowerCase().includes(animal.toLowerCase()) || 
                    animal.toLowerCase().includes(key.toLowerCase())
                );

                if (existingNodes.length > 0) {
                    delete lastAnimalData[existingNodes[0]];
                }
                lastAnimalData[animalData.commonName] = animalData;
                network.addAnimal(animalData);
                updateNetworkStats(network);
            }
            
            input.value = ''; // Clear input
        } catch (error) {
            console.error("Error processing animal:", error);
        } finally {
            // Remove loading state
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
            spinner.style.display = 'none';
            input.classList.remove('loading');
        }
    });
}

function updateNetworkStats(network: FoodChainNetwork) {
    const stats = network.getNetworkStats();
    
    // Update node statistics
    document.getElementById('total-nodes')!.textContent = stats.nodes.total.toString();
    document.getElementById('placeholder-nodes')!.textContent = stats.nodes.placeholders.toString();
    document.getElementById('complete-nodes')!.textContent = stats.nodes.complete.toString();
    
    // Update edge statistics
    document.getElementById('total-edges')!.textContent = stats.edges.total.toString();
    document.getElementById('most-connected')!.textContent = stats.edges.mostConnected;
    document.getElementById('avg-connections')!.textContent = stats.edges.avgConnections;
}

async function toggleAutomatic(
    network: FoodChainNetwork, 
    input: HTMLInputElement, 
    submitBtn: HTMLButtonElement,
    autoBtn: HTMLButtonElement
) {
    if (autoCompleteRunning) {
        autoCompleteRunning = false;
        autoBtn.textContent = "Automatic";
        autoBtn.style.backgroundColor = "#2196F3"; // Return to original blue color
    } else {
        autoCompleteRunning = true;
        autoBtn.textContent = "Stop Automatic";
        autoBtn.style.backgroundColor = "#f44336"; // Change to red while running
        
        while (autoCompleteRunning) {
            const placeholders = network.getPlaceholderNodes();
            if (placeholders.length === 0) {
                autoCompleteRunning = false;
                autoBtn.textContent = "Automatic";
                autoBtn.style.backgroundColor = "#2196F3";
                break;
            }

            // Select a random placeholder
            const randomIndex = Math.floor(Math.random() * placeholders.length);
            const randomPlaceholder = placeholders[randomIndex];

            // Set the input value and trigger the submit button
            input.value = randomPlaceholder;
            await new Promise(resolve => setTimeout(resolve, 500));
            submitBtn.click();

            // Wait for the response and update the JSON display
            await new Promise(resolve => setTimeout(resolve, 5000));
            updateNetworkStats(network);
            
            // Show the animal details for the processed node
            const jsonDisplay = document.getElementById('json-display');
            const jsonContent = document.getElementById('json-content');
            if (jsonDisplay && jsonContent) {
                const animalData = (window as any).lastAnimalData[randomPlaceholder];
                if (animalData) {
                    jsonDisplay.style.display = 'block';
                    jsonContent.textContent = JSON.stringify(animalData, null, 2);
                }
            }
        }
    }
}

main();
