import * as webllm from "@mlc-ai/web-llm";

// Logging functionality
function addLogEntry(type: 'button' | 'input' | 'llm-request' | 'llm-response', message: string) {
    const logContainer = document.getElementById('log-entries');
    if (!logContainer) return;

    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const timestamp = new Date().toLocaleTimeString();
    entry.textContent = `[${timestamp}] ${message}`;
    
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight; // Auto-scroll to bottom
}
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

    // Define template display function
    function showTemplate() {
        const jsonDisplay = document.getElementById('json-display');
        const jsonContent = document.getElementById('json-content');
        if (jsonDisplay && jsonContent) {
            const systemPrompt = "You are a biology expert. Respond only with JSON containing genus, species, common name, what the animal eats (prey), what eats it (predators), size (in meters), and diet type. Use common names for the eats and eatenBy arrays. Use lowercase for all text. For diet, use only 'herbivore', 'carnivore', 'omnivore', or 'insectivore'. For size, provide the typical length or height in meters as a number.";
            
            const template = {
                "genus": "example_genus",
                "species": "example_species",
                "commonName": "example animal",
                "eats": ["prey1", "prey2"],
                "eatenBy": ["predator1", "predator2"],
                "size": 1.5,
                "diet": "one of: herbivore, carnivore, omnivore, or insectivore"
            };

            jsonDisplay.style.display = 'block';
            jsonContent.textContent = `System Prompt:\n${systemPrompt}\n\nTemplate JSON:\n${JSON.stringify(template, null, 2)}`;
        }
    }

    // Show template on initial load
    showTemplate();

    // Setup input handling
    const input = document.getElementById('animal-input') as HTMLInputElement;
    const submitBtn = document.getElementById('submit-btn');
    if (!input || !submitBtn) throw new Error("UI elements not found");

    input.addEventListener('keypress', async (event) => {
        if (event.key === 'Enter') {
            addLogEntry('input', `User entered animal via text box: ${input.value}`);
            submitBtn.click();  // Trigger the click event on the submit button
        }
    });

    // Add random animal button handler
    const randomBtn = document.getElementById('random-btn');
    const clearBtn = document.getElementById('clear-btn');
    if (!randomBtn || !clearBtn) throw new Error("Buttons not found");


    randomBtn.addEventListener('click', async () => {
        // Disable the button while processing
        randomBtn.disabled = true;
        
        const request: webllm.ChatCompletionRequest = {
            stream: false,
            messages: [
                {
                    role: "system",
                    content: "You are a biology expert. Respond with only a single word: a random animal name. Use the common name, lowercase, singular form."
                },
                {
                    role: "user",
                    content: "Give me a random animal."
                }
            ],
            max_tokens: 32
        };

        try {
            addLogEntry('button', 'User clicked Random - requesting random animal');
            const reply = await engine.chatCompletion(request);
            const message = await engine.getMessage();
            
            // Clean up the response to ensure we just get the animal name
            const randomAnimal = message.trim().toLowerCase().split(/[\s\n]/)[0];
            
            addLogEntry('button', `Random animal selected: ${randomAnimal}`);
            
            // Set the input value and trigger the submit button
            input.value = randomAnimal;
            submitBtn.click();
        } catch (error) {
            addLogEntry('button', `Error getting random animal: ${error.message}`);
            console.error("Error getting random animal:", error);
        } finally {
            // Re-enable the button
            randomBtn.disabled = false;
        }
    });

    // Add clear button handler
    clearBtn.addEventListener('click', () => {
        addLogEntry('button', 'User clicked Clear - network cleared');
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

    // Add template button handler
    const templateBtn = document.getElementById('template-btn');
    if (!templateBtn) throw new Error("Template button not found");

    templateBtn.addEventListener('click', () => {
        addLogEntry('button', 'User requested template to be shown');
        showTemplate();
    });

    autoBtn.addEventListener('click', () => {
        addLogEntry('button', autoCompleteRunning ? 'User stopped Automatic mode' : 'User started Automatic mode');
        toggleAutomatic(network, input, submitBtn, autoBtn as HTMLButtonElement);
    });

    submitBtn.addEventListener('click', async () => {
        const animal = standardizeAnimalName(input.value.trim());
        if (!animal) return;

        // Only log if NOT in automatic mode AND NOT initiated by double-click
        if (!autoCompleteRunning && !(window as any).doubleClickInitiated) {
            addLogEntry('button', `User requested animal via text box: ${animal}`);
        }
        
        // Reset the double-click flag
        (window as any).doubleClickInitiated = false;

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
                    content: "You are a biology expert. Respond only with JSON containing genus, species, common name, what the animal eats (prey), what eats it (predators), size (in meters), and diet type. Use common names for the eats and eatenBy arrays. Use lowercase for all text. For diet, use only 'herbivore', 'carnivore', 'omnivore', or 'insectivore'. For size, provide the typical length or height in meters as a number."
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
            addLogEntry('llm-request', `Requesting data for: ${animal}`);
            const reply = await engine.chatCompletion(request);
            const message = await engine.getMessage();
            let animalData = await extractJsonFromResponse(message);
            addLogEntry('llm-response', `Received data for: ${animalData.commonName}`);
            
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
                // Check if the node already exists
                const existingNode = network.nodes.get(animalData.commonName);
                if (existingNode) {
                    // Update the existing node's data
                    lastAnimalData[animalData.commonName] = animalData;
                    // Just update the relationships without recreating the node
                    network.updateNodeAndNeighbors(animalData.commonName, animalData.commonName);
                    addLogEntry('llm-response', `Updated existing node: ${animalData.commonName}`);
                } else {
                    // Handle new node creation as before
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
                updateNetworkStats(network);
            }
            
            input.value = ''; // Clear input
        } catch (error) {
            // Add simplified error to the action log
            addLogEntry('llm-response', `Error processing ${animal}: ${error.message}`);
            // Keep the detailed console.error for debugging
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
                addLogEntry('button', 'Automatic mode completed - no more placeholders');
                autoCompleteRunning = false;
                autoBtn.textContent = "Automatic";
                autoBtn.style.backgroundColor = "#2196F3";
                break;
            }

            // Select a random placeholder
            const randomIndex = Math.floor(Math.random() * placeholders.length);
            const randomPlaceholder = placeholders[randomIndex];
            addLogEntry('llm-request', `Auto-processing placeholder: ${randomPlaceholder}`);

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
