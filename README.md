# Food Chain Visualizer

An interactive visualization tool that creates and displays food chain relationships between animals using LLM-generated data.

## Features
- Interactive network visualization of food chain relationships
- AI-powered animal data generation
- Color coding based on diet type (herbivore, carnivore, omnivore)
- Node sizing based on animal's physical size
- Automatic placeholder completion
- Random animal suggestions
- Detailed animal information display

## Setup
1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

## Usage
- Enter an animal name and press Enter or click "Add to Food Chain"
- Click "Random Animal" to add a random animal to the network
- Use "Clear Network" to reset the visualization
- Click "Auto Complete" to automatically fill in placeholder nodes
- Single-click nodes to view detailed information
- Double-click placeholder nodes to get AI-generated data

## Note
If you would like to hack WebLLM core package, you can change web-llm dependencies as `"file:../.."`, and follow the build from source instruction in the project to build webllm locally. This option is only recommended if you would like to hack WebLLM core package.
