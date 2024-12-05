import * as webllm from "@mlc-ai/web-llm";
import { FoodChainNetwork, AnimalData } from './network';

let lastAnimalData: { [key: string]: AnimalData } = {};
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
    return JSON.parse(jsonMatch[0]);
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

    submitBtn.addEventListener('click', async () => {
        const animal = input.value.trim();
        if (!animal) return;

        // Get spinner element
        const spinner = document.getElementById('loading-spinner');
        if (!spinner) throw new Error("Spinner not found");

        // Show loading state
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;
        spinner.style.display = 'inline-block';
        input.classList.add('loading');

        const request: webllm.ChatCompletionRequest = {
            stream: false,
            messages: [
                {
                    role: "system",
                    content: "You are a biology expert. Respond only with JSON containing genus, species, common name, what the animal eats (prey), and what eats it (predators). Use common names for the eats and eatenBy arrays."
                },
                {
                    role: "user",
                    content: `Provide information about ${animal} in this JSON format: {"genus": "", "species": "", "commonName": "", "eats": [], "eatenBy": []}`
                }
            ],
            max_tokens: 256,
            response_format: { type: "json_object" } as webllm.ResponseFormat,
        };

        try {
            const reply = await engine.chatCompletion(request);
            const message = await engine.getMessage();
            const animalData = await extractJsonFromResponse(message);
            network.addAnimal(animalData);
            lastAnimalData[animalData.commonName] = animalData;  // Store the data
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

main();
