console.log('🔥 BACKGROUND: Script starting...');

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('🔥 BACKGROUND: Message received:', message.action);

    if (message.action === 'ping') {
        sendResponse({ pong: true, timestamp: Date.now() });
        return false;
    }

    if (message.action === 'generateComment') {
        generateComment(message.postData, message.settings, message.userProfile)
            .then(comment => sendResponse({ comment }))
            .catch(error => sendResponse({ error: error.message }));
        return true;
    }

    return false;
});

// Main comment generation
async function generateComment(postData, settings, userProfile) {
    console.log('🔥 Generating comment...', { postData, settings, userProfile });

    const apiProvider = settings.apiProvider || 'groq';

    // Validate API key
    if (apiProvider === 'groq' && !settings.groqApiKey) {
        throw new Error('Groq API key not configured');
    }
    if (apiProvider === 'gemini' && !settings.geminiApiKey) {
        throw new Error('Gemini API key not configured');
    }

    const config = {
        tone: settings.commentTone || 'insightful',
        length: settings.commentLength || 'medium',
        profile: userProfile || {}
    };

    // Create the prompt
    const prompt = createPrompt(postData, config);
    console.log('🔥 Prompt created, calling API...');

    if (apiProvider === 'groq') {
        return await callGroqAPI(prompt, settings.groqApiKey, config);
    } else {
        return await callGeminiAPI(prompt, settings.geminiApiKey, config);
    }
}

// Create prompt based on tone
function createPrompt(postData, config) {
    const { tone, length, profile } = config;
    const postContent = postData.content || '';
    const postAuthor = postData.author || 'someone';

    // Length guidelines
    const lengthMap = {
        'short': '1-2 sentences (max 150 characters)',
        'medium': '2-3 sentences (max 250 characters)',
        'detailed': '3-4 sentences (max 350 characters)'
    };

    // Profile context
    let profileContext = '';
    if (profile.name && profile.role) {
        profileContext = `
YOUR PROFILE:
- Name: ${profile.name}
- Role: ${profile.role}
- Expertise: ${profile.expertise || 'Business automation, AI implementation'}

Naturally weave your expertise when relevant. Don't force it. You help businesses automate and implement AI - only mention this if the post topic allows it organically.`;
    }

    // Tone-specific instructions
    const toneInstructions = {
        'hot-take': `
TONE: HOT TAKE / CONTRARIAN 🔥
Your goal is to share a bold, contrarian opinion that makes people stop and think.

STYLE GUIDE:
- Start with a bold statement that challenges the norm
- Back it up with quick logic or experience
- Don't be rude, be thought-provoking
- Use confident language: "Here's the thing...", "Unpopular opinion:", "Most people miss this..."

EXAMPLES OF GREAT HOT TAKES:
"Unpopular opinion: the 'hustle culture' this promotes is exactly why burnout rates are skyrocketing. Working smarter beats working harder 10/10 times."

"Here's the thing most people miss about AI tools - they're not replacing jobs, they're exposing who was actually adding value vs who was just busy."

"Hot take: This 'overnight success' probably took 10 years of failures nobody posted about. The highlight reel culture needs to die."`,

        'insightful': `
TONE: INSIGHTFUL / THOUGHTFUL 💡
Your goal is to add genuine value with a unique perspective or insight.

STYLE GUIDE:
- Start with an observation about what you noticed
- Add a layer of insight others might miss
- Connect it to a broader trend or pattern
- Sound like a smart friend sharing wisdom, not a consultant pitching

EXAMPLES OF GREAT INSIGHTS:
"What's interesting here is the timing. Companies are realizing AI isn't optional anymore - it's table stakes. The ones still 'evaluating' are already behind."

"This hits different when you realize it's not about the tool, it's about the process change. Most automation fails because people automate broken workflows."

"I've noticed this pattern with every major tech shift - the early adopters don't win because they're first, they win because they learn to adapt faster."`,

        'supportive': `
TONE: SUPPORTIVE / AGREEMENT 🤝  
Your goal is to validate and add value, building connection with the author.

STYLE GUIDE:
- Start with genuine appreciation (NOT "Great post!" - that's lazy)
- Add your own related experience or observation
- Make the author feel seen and understood
- End by reinforcing or extending their point

EXAMPLES OF GREAT SUPPORTIVE COMMENTS:
"This resonates hard. We've seen the exact same thing with our B2B clients - the resistance to change costs way more than the change itself."

"Saving this one. The framework here is solid, especially the part about starting small. Too many people try to automate everything at once and burn out."

"Needed this reminder today. It's easy to get caught up in the noise and forget the fundamentals actually work."`,

        'curious': `
TONE: CURIOUS / QUESTION-LED ❓
Your goal is to ask a smart question that positions you as thoughtful and sparks discussion.

STYLE GUIDE:
- Start with a brief observation or reaction
- Ask a genuine question you'd actually want answered
- The question should showcase your expertise subtly
- Make it open-ended to invite discussion

EXAMPLES OF GREAT CURIOUS COMMENTS:
"This is fascinating. Curious though - have you seen this approach work better for B2B or B2C? The buying cycles are so different."

"Love the framework. One thing I'm wondering: how do you handle the resistance from teams who see automation as a threat to their jobs?"

"Solid point. I'm curious what changed the most for you during this process - the systems or the mindset?"`
    };

    return `You are writing a LinkedIn comment as a professional. You're ${profile.name || 'an automation consultant'} - ${profile.role || 'helping businesses implement AI and automation'}.

POST BY ${postAuthor}:
"${postContent}"

${toneInstructions[tone] || toneInstructions['insightful']}
${profileContext}

CRITICAL RULES:
1. LENGTH: ${lengthMap[length]}. Stay within this limit strictly.
2. NO AI-SPEAK: Never say "Great post!", "Absolutely!", "Couldn't agree more!", "This is so true!", "Well said!"
3. BE HUMAN: Use contractions (I've, that's, don't). Mix sentence lengths. Be conversational.
4. NO HASHTAGS: Never include hashtags
5. BE SPECIFIC: Reference something specific from the post
6. NO FILLER: Every word should add value
7. COMPLETE THOUGHTS: Write full sentences that end properly

BANNED PHRASES (never use these):
- "Great post"
- "Love this"  
- "So true"
- "Absolutely"
- "Couldn't agree more"
- "This resonates"
- "Well articulated"
- "Thank you for sharing"
- "Spot on"

Write your comment now. Just the comment text, nothing else.`;
}

// Groq API call
async function callGroqAPI(prompt, apiKey, config) {
    const models = ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'];
    let lastError;

    for (const model of models) {
        try {
            console.log(`🔥 Trying Groq model: ${model}`);

            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an expert LinkedIn commenter. Write natural, engaging comments that sound human. Never use generic phrases like "Great post". Be specific and add value.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.8,
                    max_tokens: 200,
                    top_p: 0.9
                })
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            let comment = data.choices?.[0]?.message?.content?.trim();

            if (!comment) {
                throw new Error('Empty response');
            }

            // Clean up the comment
            comment = cleanComment(comment);

            console.log('✅ Comment generated:', comment);
            return comment;

        } catch (error) {
            console.warn(`⚠️ ${model} failed:`, error.message);
            lastError = error;
        }
    }

    throw lastError || new Error('All models failed');
}

// Gemini API call
async function callGeminiAPI(prompt, apiKey, config) {
    const models = ['gemini-1.5-flash', 'gemini-1.5-pro'];

    for (const model of models) {
        try {
            console.log(`🔥 Trying Gemini model: ${model}`);

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.8,
                        maxOutputTokens: 200,
                        topP: 0.9
                    }
                })
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            let comment = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

            if (!comment) {
                throw new Error('Empty response');
            }

            comment = cleanComment(comment);
            console.log('✅ Comment generated:', comment);
            return comment;

        } catch (error) {
            console.warn(`⚠️ ${model} failed:`, error.message);
            if (model === models[models.length - 1]) throw error;
        }
    }
}

// Clean up comment
function cleanComment(text) {
    let cleaned = text;

    // Remove quotes if the AI wrapped the comment in quotes
    cleaned = cleaned.replace(/^["']|["']$/g, '');

    // Remove any "Comment:" prefix
    cleaned = cleaned.replace(/^(Comment|Response|Reply):\s*/i, '');

    // Remove hashtags
    cleaned = cleaned.replace(/#\w+/g, '');

    // Remove multiple spaces
    cleaned = cleaned.replace(/\s+/g, ' ');

    // Remove banned phrases at the start
    const bannedStarts = [
        /^Great post[!.]?\s*/i,
        /^Love this[!.]?\s*/i,
        /^So true[!.]?\s*/i,
        /^Absolutely[!.]?\s*/i,
        /^Well said[!.]?\s*/i,
        /^This is great[!.]?\s*/i,
        /^Spot on[!.]?\s*/i,
        /^This resonates[!.]?\s*/i
    ];

    for (const pattern of bannedStarts) {
        cleaned = cleaned.replace(pattern, '');
    }

    // Ensure proper capitalization after cleanup
    if (cleaned.length > 0) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    // Ensure proper ending
    cleaned = cleaned.trim();
    if (cleaned && !cleaned.match(/[.!?]$/)) {
        cleaned += '.';
    }

    return cleaned;
}

console.log('🔥 BACKGROUND: Script loaded');