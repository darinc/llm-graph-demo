# Food Chain Visualizer

An interactive demonstration of Large Language Models (LLMs) running directly in the browser, showcased through a food chain visualization tool. This project demonstrates how AI models can be integrated into web applications without requiring server-side processing.

## Overview
This application uses WebLLM to run a quantized LLM directly in your browser. It generates detailed biological information about animals and their food chain relationships in real-time, demonstrating the capabilities of client-side AI processing.

## Key Technical Features
- Browser-based LLM execution using WebLLM
- No server requirements - all processing happens client-side
- Efficient model loading and execution
- Structured JSON outputs from natural language queries
- Interactive visualization of AI-generated data

## Visualization Features
- Interactive network visualization of food chain relationships
- Color coding based on diet type:
  - Green: Herbivores
  - Red: Carnivores
  - Orange: Omnivores
- Dynamic node sizing based on animal's physical size
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

## Technical Details
- Uses Llama-3.2-3B-Instruct model (quantized for browser execution)
- Generates structured JSON responses for consistent data formatting
- Implements WebLLM for client-side model execution
- Visualizes data using vis.js network library

## Browser Compatibility
The application requires a modern browser with WebAssembly support. Performance may vary depending on your device's capabilities.

## Note
This project demonstrates the potential of running AI models directly in the browser, making AI-powered applications more accessible and reducing the need for server-side infrastructure.
