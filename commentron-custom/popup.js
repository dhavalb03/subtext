class Subtext {
    constructor() {
        this.currentTone = 'insightful';
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.bindEvents();
        await this.checkApiKey();
    }

    async loadSettings() {
        const settings = await chrome.storage.local.get([
            'apiProvider', 'groqApiKey', 'geminiApiKey',
            'commentTone', 'commentLength', 'autoGenerateOnClick',
            'profileName', 'profileRole', 'profileExpertise'
        ]);

        // Load API provider
        const provider = settings.apiProvider || 'groq';
        document.getElementById('api-provider').value = provider;
        this.toggleApiSections(provider);

        // Load comment settings
        if (settings.commentTone) {
            this.currentTone = settings.commentTone;
            this.updateToneButtons();
        }
        if (settings.commentLength) {
            document.getElementById('comment-length').value = settings.commentLength;
        }
        if (settings.autoGenerateOnClick) {
            document.getElementById('auto-generate-on-click').checked = true;
        }

        // Load profile
        await this.loadProfile();
    }

    async loadProfile() {
        const profile = await chrome.storage.local.get(['profileName', 'profileRole', 'profileExpertise']);

        if (profile.profileName && profile.profileRole) {
            // Show saved profile
            document.querySelector('.profile-form').style.display = 'none';
            document.getElementById('profile-display').style.display = 'flex';
            document.getElementById('profile-summary').textContent =
                `${profile.profileName} • ${profile.profileRole}`;
        } else {
            // Show profile form
            document.querySelector('.profile-form').style.display = 'flex';
            document.getElementById('profile-display').style.display = 'none';
        }

        // Fill form fields if they exist
        if (profile.profileName) document.getElementById('profile-name').value = profile.profileName;
        if (profile.profileRole) document.getElementById('profile-role').value = profile.profileRole;
        if (profile.profileExpertise) document.getElementById('profile-expertise').value = profile.profileExpertise;
    }

    bindEvents() {
        // API events
        document.getElementById('save-api').addEventListener('click', () => this.saveApiKey());
        document.getElementById('api-provider').addEventListener('change', (e) => {
            this.toggleApiSections(e.target.value);
            chrome.storage.local.set({ apiProvider: e.target.value });
        });

        // Profile events
        document.getElementById('save-profile').addEventListener('click', () => this.saveProfile());
        document.getElementById('edit-profile').addEventListener('click', () => this.editProfile());

        // Tone selector events
        document.querySelectorAll('.tone-btn').forEach(btn => {
            btn.addEventListener('click', () => this.selectTone(btn.dataset.tone));
        });

        // Comment settings
        document.getElementById('comment-length').addEventListener('change', () => this.saveSettings());
        document.getElementById('auto-generate-on-click').addEventListener('change', (e) => {
            chrome.storage.local.set({ autoGenerateOnClick: e.target.checked });
        });

        // Generate/post comment
        document.getElementById('generate-comment').addEventListener('click', () => this.generateComment());
        document.getElementById('post-comment').addEventListener('click', () => this.postComment());
        document.getElementById('copy-comment').addEventListener('click', () => this.copyComment());
        document.getElementById('regenerate-comment').addEventListener('click', () => this.generateComment());
    }

    toggleApiSections(provider) {
        const geminiSection = document.getElementById('gemini-api-section');
        const groqSection = document.getElementById('groq-api-section');

        if (provider === 'groq') {
            geminiSection.style.display = 'none';
            groqSection.style.display = 'block';
        } else {
            geminiSection.style.display = 'block';
            groqSection.style.display = 'none';
        }
    }

    async checkApiKey() {
        const result = await chrome.storage.local.get(['geminiApiKey', 'groqApiKey', 'apiProvider']);
        const provider = result.apiProvider || 'groq';
        const hasKey = (provider === 'groq' && result.groqApiKey) || (provider === 'gemini' && result.geminiApiKey);

        if (hasKey) {
            this.updateStatus('Ready to generate comments', 'success');
            document.getElementById('api-section').style.display = 'none';
        } else {
            this.updateStatus('Please add your API key', 'warning');
        }
    }

    async saveApiKey() {
        const provider = document.getElementById('api-provider').value;

        if (provider === 'groq') {
            const key = document.getElementById('groq-api-key').value.trim();
            if (!key) {
                this.updateStatus('Please enter your Groq API key', 'error');
                return;
            }
            await chrome.storage.local.set({ groqApiKey: key, apiProvider: 'groq' });
            document.getElementById('groq-api-key').value = '';
        } else {
            const key = document.getElementById('api-key').value.trim();
            if (!key) {
                this.updateStatus('Please enter your Gemini API key', 'error');
                return;
            }
            await chrome.storage.local.set({ geminiApiKey: key, apiProvider: 'gemini' });
            document.getElementById('api-key').value = '';
        }

        this.updateStatus('API key saved!', 'success');
        document.getElementById('api-section').style.display = 'none';
    }

    async saveProfile() {
        const name = document.getElementById('profile-name').value.trim();
        const role = document.getElementById('profile-role').value.trim();
        const expertise = document.getElementById('profile-expertise').value.trim();

        if (!name || !role) {
            this.updateStatus('Please enter your name and role', 'error');
            return;
        }

        await chrome.storage.local.set({
            profileName: name,
            profileRole: role,
            profileExpertise: expertise
        });

        this.updateStatus('Profile saved!', 'success');
        await this.loadProfile();
    }

    editProfile() {
        document.querySelector('.profile-form').style.display = 'flex';
        document.getElementById('profile-display').style.display = 'none';
    }

    selectTone(tone) {
        this.currentTone = tone;
        this.updateToneButtons();
        chrome.storage.local.set({ commentTone: tone });
    }

    updateToneButtons() {
        document.querySelectorAll('.tone-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tone === this.currentTone);
        });
    }

    async saveSettings() {
        const settings = {
            commentLength: document.getElementById('comment-length').value,
            commentTone: this.currentTone
        };
        await chrome.storage.local.set(settings);
    }

    async generateComment() {
        try {
            this.updateStatus('Generating comment...', 'info');

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab.url.includes('linkedin.com')) {
                this.updateStatus('Please navigate to LinkedIn', 'error');
                return;
            }

            // Extract post content
            const postData = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: this.extractPostContent
            });

            let content = postData[0]?.result;
            if (!content) {
                this.updateStatus('Could not find post content', 'error');
                return;
            }

            // Generate via background script
            const comment = await this.callAPI(content);

            if (comment) {
                document.getElementById('generated-comment').textContent = comment;
                document.getElementById('generated-comment').classList.add('show');
                document.getElementById('comment-actions').style.display = 'flex';
                this.updateStatus('Comment generated!', 'success');
            }

        } catch (error) {
            console.error('Error:', error);
            this.updateStatus('Error: ' + error.message, 'error');
        }
    }

    extractPostContent() {
        // Try multiple selectors for post content
        const selectors = [
            '.feed-shared-update-v2__description-wrapper .break-words',
            '.feed-shared-update-v2__description-wrapper span[dir="ltr"]',
            '.update-components-text span[dir="ltr"]',
            '.feed-shared-text__text-view',
            '.feed-shared-update-v2__commentary'
        ];

        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
                const text = el.innerText?.trim();
                if (text && text.length > 20 && text.length < 5000) {
                    // Find author
                    const post = el.closest('.feed-shared-update-v2, .occludable-update');
                    const authorEl = post?.querySelector('.feed-shared-actor__name span[aria-hidden="true"]');

                    return {
                        content: text,
                        author: authorEl?.innerText?.trim() || 'Unknown'
                    };
                }
            }
        }
        return null;
    }

    async callAPI(postData) {
        const settings = await chrome.storage.local.get([
            'geminiApiKey', 'groqApiKey', 'apiProvider',
            'commentTone', 'commentLength',
            'profileName', 'profileRole', 'profileExpertise'
        ]);

        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'generateComment',
                postData: postData,
                settings: {
                    ...settings,
                    commentTone: this.currentTone,
                    commentLength: document.getElementById('comment-length').value
                },
                userProfile: {
                    name: settings.profileName,
                    role: settings.profileRole,
                    expertise: settings.profileExpertise
                }
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (response?.error) {
                    reject(new Error(response.error));
                } else if (response?.comment) {
                    resolve(response.comment);
                } else {
                    reject(new Error('Invalid response'));
                }
            });
        });
    }

    async copyComment() {
        const comment = document.getElementById('generated-comment').textContent;
        if (comment) {
            await navigator.clipboard.writeText(comment);
            this.updateStatus('Copied to clipboard!', 'success');
        }
    }

    async postComment() {
        try {
            const comment = document.getElementById('generated-comment').textContent;
            if (!comment) {
                this.updateStatus('No comment to post', 'error');
                return;
            }

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (text) => {
                    const selectors = [
                        '.comments-comment-box-comment__text-editor[contenteditable="true"]',
                        '.comments-comment-box__text-editor[contenteditable="true"]',
                        'div[contenteditable="true"][role="textbox"]'
                    ];

                    for (const sel of selectors) {
                        const box = document.querySelector(sel);
                        if (box) {
                            box.focus();
                            box.textContent = text;
                            box.dispatchEvent(new Event('input', { bubbles: true }));
                            return true;
                        }
                    }
                    return false;
                },
                args: [comment]
            });

            this.updateStatus('Comment inserted! Click the blue Post button.', 'success');

        } catch (error) {
            this.updateStatus('Error posting: ' + error.message, 'error');
        }
    }

    updateStatus(message, type = 'info') {
        const statusEl = document.getElementById('status');
        statusEl.textContent = message;
        statusEl.className = `status ${type}`;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new Subtext();
});