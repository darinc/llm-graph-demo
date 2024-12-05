import * as webllm from "@mlc-ai/web-llm";
import { FoodChainNetwork, AnimalData } from './network';

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
        commonName: data.commonName.toLowerCase(),
        eats: data.eats.map((item: string) => item.toLowerCase()),
        eatenBy: data.eatenBy.map((item: string) => item.toLowerCase()),
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
        (window as any).lastAnimalData = lastAnimalData;
        const jsonDisplay = document.getElementById('json-display');
        if (jsonDisplay) {
            jsonDisplay.style.display = 'none';
        }
    });

    const autoBtn = document.getElementById('auto-btn');
    if (!autoBtn) throw new Error("Auto button not found");

    autoBtn.addEventListener('click', () => {
        autoCompletePlaceholders(network, input, submitBtn, autoBtn as HTMLButtonElement);
    });

    submitBtn.addEventListener('click', async () => {
        const animal = input.value.trim().toLowerCase();
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

        // Get existing relationships whether it's a placeholder or being replaced
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
            const animalData = await extractJsonFromResponse(message);
            
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

async function autoCompletePlaceholders(
    network: FoodChainNetwork, 
    input: HTMLInputElement, 
    submitBtn: HTMLButtonElement,
    autoBtn: HTMLButtonElement
) {
    if (autoCompleteRunning) {
        autoCompleteRunning = false;
        autoBtn.textContent = "Auto Complete";
        return;
    }

    autoCompleteRunning = true;
    autoBtn.textContent = "Stop";

    while (autoCompleteRunning) {
        const placeholders = network.getPlaceholderNodes();
        if (placeholders.length === 0) {
            autoCompleteRunning = false;
            autoBtn.textContent = "Auto Complete";
            break;
        }

        // Select a random placeholder
        const randomIndex = Math.floor(Math.random() * placeholders.length);
        const randomPlaceholder = placeholders[randomIndex];

        // Set the input value and trigger the submit button
        input.value = randomPlaceholder;
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
        submitBtn.click();

        // Wait for the response
        await new Promise(resolve => setTimeout(resolve, 5000)); // Adjust timing as needed
    }
}

main();
