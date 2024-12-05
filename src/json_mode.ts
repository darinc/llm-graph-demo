import * as webllm from "@mlc-ai/web-llm";
import { FoodChainNetwork, AnimalData } from './network';

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

    // Setup input handling
    const input = document.getElementById('animal-input') as HTMLInputElement;
    const submitBtn = document.getElementById('submit-btn');
    if (!input || !submitBtn) throw new Error("UI elements not found");

    submitBtn.addEventListener('click', async () => {
        const animal = input.value.trim();
        if (!animal) return;

        const request: webllm.ChatCompletionRequest = {
            stream: false,
            messages: [
                {
                    role: "system",
                    content: "You are a biology expert. Respond only with JSON containing genus, species, what the animal eats (prey), and what eats it (predators)."
                },
                {
                    role: "user",
                    content: `Provide information about ${animal} in this JSON format: {"genus": "", "species": "", "eats": [], "eatenBy": []}`
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
            input.value = ''; // Clear input
        } catch (error) {
            console.error("Error processing animal:", error);
        }
    });
}

main();
