// Load environment variables from .env file (local development only)
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.ANTHROPIC_API_KEY;

const scenePrompts = {
  Cottage: `You are narrating a calm bedtime story for a young child.
Story: Goldilocks and the Three Bears
Current Scene:
Goldilocks is walking through the forest and has just discovered a small wooden cottage.
The cottage has a wooden door, a chimney with smoke curling gently from the top, and a small window.
The path leading to the cottage is quiet and dappled with sunlight through the trees.
Important story state:
The bears are not home - they have gone for a walk in the forest.
Goldilocks has not yet gone inside.
Narration rules:
- Stay outside the cottage.
- Do not advance the story beyond this moment.
- Do not bring the bears home yet.
- Do not introduce new permanent characters.
- Keep the tone warm, calm, and suitable for a bedtime story.
- The response should be gentle and imaginative but not scary.
- Keep the response short (1–3 sentences).
- Do not use framing phrases like "speaking in a soft voice" or any meta-narration. Just tell the story directly.
Parent's question:
{PARENT_QUESTION}
Respond as a storyteller speaking to a child.`,

  Kitchen: `You are narrating a calm bedtime story for a young child.
Story: Goldilocks and the Three Bears
Current Scene:
Goldilocks has just entered the bears' kitchen and is standing near the table.
On the wooden table are three bowls of porridge:
- one big bowl
- one medium bowl
- one small bowl
Each bowl has a spoon.
Behind the table there is a small stove with a kettle on top.
The room is simple and warm with wooden floors.
Important story state:
The bears are not home yet.
Goldilocks has not tasted the porridge yet.
Narration rules:
- Stay inside the kitchen scene.
- Do not advance the story beyond this moment.
- Do not bring the bears home yet.
- Do not introduce new permanent characters.
- Keep the tone warm, calm, and suitable for a bedtime story.
- The response should be gentle and imaginative but not scary.
- Keep the response short (1–3 sentences).
- Do not use framing phrases like "speaking in a soft voice" or any meta-narration. Just tell the story directly.
Parent's question:
{PARENT_QUESTION}
Respond as a storyteller speaking to a child.`,

  Bedroom: `You are narrating a calm bedtime story for a young child.
Story: Goldilocks and the Three Bears
Current Scene:
Goldilocks has climbed the stairs and found the bears' bedroom.
In the room are three beds:
- one big bed with a thick heavy blanket
- one medium bed with a patchwork quilt
- one small bed that looks just the right size
The room is quiet and cosy with soft light coming through a small window.
Important story state:
The bears are not home yet.
Goldilocks has not yet tried the beds.
Narration rules:
- Stay inside the bedroom scene.
- Do not advance the story beyond this moment.
- Do not bring the bears home yet.
- Do not introduce new permanent characters.
- Keep the tone warm, calm, and suitable for a bedtime story.
- The response should be gentle and imaginative but not scary.
- Keep the response short (1–3 sentences).
- Do not use framing phrases like "speaking in a soft voice" or any meta-narration. Just tell the story directly.
Parent's question:
{PARENT_QUESTION}
Respond as a storyteller speaking to a child.`,

  BearsReturn: `You are narrating a calm bedtime story for a young child.
Story: Goldilocks and the Three Bears
Current Scene:
The three bears have just returned home from their walk in the forest.
Papa Bear, Mama Bear and Baby Bear are in the kitchen noticing that someone has been eating their porridge.
The atmosphere is one of surprise and puzzlement rather than anger.
Important story state:
Goldilocks is upstairs asleep in Baby Bear's bed.
The bears do not know who has been in their house yet.
Narration rules:
- Stay in this moment of discovery.
- Do not reveal what happens next or that Goldilocks will be found.
- Do not advance the story to the bedroom yet.
- Do not introduce new permanent characters.
- Keep the tone warm, calm, and suitable for a bedtime story.
- The response should be gentle and imaginative but not scary.
- Keep the response short (1–3 sentences).
- Do not use framing phrases like "speaking in a soft voice" or any meta-narration. Just tell the story directly.
Parent's question:
{PARENT_QUESTION}
Respond as a storyteller speaking to a child.`
};

const sceneDescriptions = {
  Cottage: `Goldilocks is outside a small wooden cottage in the forest. The cottage has a wooden door, a chimney with smoke curling gently from the top, and a small window. The path is quiet and dappled with sunlight. The bears are not home.`,
  Kitchen: `Goldilocks is in the bears' kitchen. On the table are three bowls of porridge - one big, one medium, one small. Each has a spoon. There is a small stove with a kettle behind the table. The room is warm with wooden floors. The bears are not home.`,
  Bedroom: `Goldilocks is in the bears' bedroom. There are three beds - one big with a heavy blanket, one medium with a patchwork quilt, one small that looks just right. The room is quiet and cosy with soft light from a small window. The bears are not home.`,
  BearsReturn: `The three bears have just come home from their walk. Papa Bear, Mama Bear and Baby Bear are in the kitchen discovering someone has been eating their porridge. They are surprised and puzzled rather than angry. Goldilocks is upstairs asleep.`
};

const interruptDescriptions = {
  look: "The child wants to look more closely and notice details about",
  imagine: "The child wants to imagine and wonder about",
  ask: "The child wants to ask a question about",
  scared: "The child feels a little worried or scared about"
};

const emotionTones = {
    curious: `Tone: Respond with warmth and gentle factual wonder. Satisfy the curiosity with a specific, grounded detail that feels true to the story world.`,
    anxious: `Tone: Respond with extra softness and reassurance. Emphasise calm, safety, and stillness. Avoid words like "dark", "alone", "scary", "sudden", or "creak". Frame everything as peaceful and unhurried. Do not remove story tension entirely but soften all edges.`,
    imaginative: `Tone: Respond with playful wonder and gentle whimsy. Lean into the imaginative spirit of the question. Use sensory details and light fantastical touches that feel magical but not overwhelming.`
};

const pacingInstructions = {
    open: `Pacing: The story is just beginning. Responses can be full and playful, rich with imaginative detail. The child has plenty of time to explore.`,
    winding: `Pacing: The story is settling down. Keep responses a little shorter and calmer. Gently guide toward the story rather than expanding outward.`,
    closing: `Pacing: It is getting late in the story. Responses should be short, soft and soothing. Use sleepy, cosy language. Gently nudge toward the story's end.`
};

app.post('/ask', async (req, res) => {
    const { question, scene, emotion, pacing } = req.body;
    const basePrompt = scenePrompts[scene];
    const pacingLine = pacingInstructions[pacing] || pacingInstructions.open;
    if (!basePrompt) {
        return res.status(400).json({ error: 'Unknown scene' });
    }
    const toneLine = emotionTones[emotion] || emotionTones.curious;
    const prompt = basePrompt.replace(
        'Respond as a storyteller speaking to a child.',
        `${toneLine}\n${pacingLine}\nRespond as a storyteller speaking to a child.`
    ).replace('{PARENT_QUESTION}', question);

    try {
        const response = await axios.post('https://api.anthropic.com/v1/messages', {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 200,
            messages: [{ role: 'user', content: prompt }]
        }, {
            headers: {
                'x-api-key': API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            }
        });
        res.json({ text: response.data.content[0].text });
    } catch (err) {
        console.error('Error:', err.response ? err.response.data : err.message);
        res.status(500).json({ error: 'API call failed' });
    }
});

app.post('/detour', async (req, res) => {
    const { scene, anchor, interrupt, memory, pacing } = req.body;
    const pacingLine = pacingInstructions[pacing] || pacingInstructions.open;

    let memoryBlock = '';
    if (memory && memory.length > 0) {
        memoryBlock = '\nRecent story moments (for consistency):\n' +
            memory.map(m => `- ${m.type} about ${m.anchor}: ${m.summary}`).join('\n') + '\n';
    }

    const prompt = `You are narrating a calm bedtime story for a young child about Goldilocks and the Three Bears.
Scene: ${sceneDescriptions[scene]}
${memoryBlock}
${pacingLine}
${interruptDescriptions[interrupt]} the ${anchor}.
Respond in 2-3 short sentences, warm and imaginative, suitable for a bedtime story. Stay consistent with any recent story moments listed above. Do not advance the story beyond this moment. Do not use framing phrases. Just tell the story directly to the child.`;

    try {
        const response = await axios.post('https://api.anthropic.com/v1/messages', {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 200,
            messages: [{ role: 'user', content: prompt }]
        }, {
            headers: {
                'x-api-key': API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            }
        });
        res.json({ text: response.data.content[0].text });
    } catch (err) {
        console.error('Error:', err.response ? err.response.data : err.message);
        res.status(500).json({ error: 'API call failed' });
    }
});

app.post('/detour-followup', async (req, res) => {
    const { scene, anchor, interrupt, memory, pacing } = req.body;
    const pacingLine = pacingInstructions[pacing] || pacingInstructions.open;

    let memoryBlock = '';
    if (memory && memory.length > 0) {
        memoryBlock = '\nRecent story moments (for consistency):\n' +
            memory.map(m => `- ${m.type} about ${m.anchor}: ${m.summary}`).join('\n') + '\n';
    }

    const interruptFollowDescriptions = {
        look: "The child wants to look even more closely and notice more details about",
        imagine: "The child wants to imagine further and wonder more about",
        ask: "The child wants to ask another question about",
        scared: "The child is still a little worried and wants more reassurance about"
    };

    const prompt = `You are narrating a calm bedtime story for a young child about Goldilocks and the Three Bears.
Scene: ${sceneDescriptions[scene]}
${memoryBlock}
${pacingLine}
The child already heard this about the ${anchor}: the most recent memory entry above.
Now ${interruptFollowDescriptions[interrupt]} the ${anchor} — but say something NEW that was not already mentioned.
Do not repeat details from the recent story moments listed above.
Add a fresh detail, a new observation, or take the imagination somewhere slightly different.
Respond in 2-3 short sentences. Warm and imaginative, suitable for a bedtime story. Do not advance the story. Do not use framing phrases. Just tell the story directly to the child.`;
    try {
        const response = await axios.post('https://api.anthropic.com/v1/messages', {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 200,
            messages: [{ role: 'user', content: prompt }]
        }, {
            headers: {
                'x-api-key': API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            }
        });
        res.json({ text: response.data.content[0].text });
    } catch (err) {
        console.error('Error:', err.response ? err.response.data : err.message);
        res.status(500).json({ error: 'API call failed' });
    }
});

app.post('/summarise', async (req, res) => {
    const { anchor, interrupt, response } = req.body;

    const prompt = `In 8-10 words, summarise the key visual details mentioned in this story moment.
Anchor: ${anchor}
Type: ${interrupt}
Story response: ${response}
Focus on colours, textures, and specific objects mentioned. Reply with only the summary phrase. Example: "green door with brass knocker and carved flowers"`;

    try {
        const result = await axios.post('https://api.anthropic.com/v1/messages', {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 30,
            messages: [{ role: 'user', content: prompt }]
        }, {
            headers: {
                'x-api-key': API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            }
        });
        res.json({ summary: result.data.content[0].text.trim() });
    } catch (err) {
        console.error('Error:', err.response ? err.response.data : err.message);
        res.status(500).json({ error: 'Summarise failed' });
    }
});

app.post('/detect-emotion', async (req, res) => {
    const { question } = req.body;

    const prompt = `Classify the emotional tone of this question from a parent reading a bedtime story to a child.
Question: "${question}"
Reply with exactly one word from this list: curious, anxious, imaginative
- curious: factual questions, wanting to understand something
- anxious: worry, fear, uncertainty, concern
- imaginative: what if, pretend, wonder, playful speculation
Reply with only the single word, nothing else.`;

    try {
        const response = await axios.post('https://api.anthropic.com/v1/messages', {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 10,
            messages: [{ role: 'user', content: prompt }]
        }, {
            headers: {
                'x-api-key': API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            }
        });
        const emotion = response.data.content[0].text.trim().toLowerCase();
        const valid = ['curious', 'anxious', 'imaginative'];
        res.json({ emotion: valid.includes(emotion) ? emotion : 'curious' });
    } catch (err) {
        console.error('Error:', err.response ? err.response.data : err.message);
        res.json({ emotion: 'curious' });
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));



