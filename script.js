document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURATION ---
    // IMPORTANT: Replace these placeholders with your actual Airtable details.
    const AIRTABLE_API_KEY = 'YOUR_AIRTABLE_API_KEY';
    const AIRTABLE_BASE_ID = 'YOUR_AIRTABLE_BASE_ID';
    const AIRTABLE_TABLE_NAME = 'YOUR_TABLE_NAME';
    const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`;

    // This is the key you provided for the OpenAI API.
    const OPENAI_API_KEY = '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';
    const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

    // --- ELEMENT SELECTORS ---
    const form = document.getElementById('deal-form');
    const checkboxes = document.querySelectorAll('#interactive-checklist input[type="checkbox"]');
    const progressBarFill = document.getElementById('progress-bar-fill');
    const progressText = document.getElementById('progress-text');
    const addPathStepBtn = document.getElementById('add-path-step');
    const pathToCloseContainer = document.getElementById('path-to-close-container');

    const saveBtn = document.getElementById('save-deal-btn');
    const loadBtn = document.getElementById('load-deal-btn');
    const analyzeBtn = document.getElementById('analyze-deal-btn');
    
    const modal = document.getElementById('ai-modal');
    const modalCloseBtn = document.querySelector('.close-button');
    const aiResponseContainer = document.getElementById('ai-response');

    // --- CORE FUNCTIONS ---

    const updateProgress = () => {
        const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
        const totalCount = checkboxes.length;
        const percentage = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
        
        progressBarFill.style.width = `${percentage}%`;
        progressText.textContent = `${percentage}%`;
    };
    
    const getFormData = () => {
        const formData = new FormData(form);
        const data = {};
        // Convert FormData to a simple object
        for (let [key, value] of formData.entries()) {
            if (key.endsWith('[]')) { // Handle array fields like 'path-to-close'
                const arrayKey = key.slice(0, -2);
                if (!data[arrayKey]) data[arrayKey] = [];
                data[arrayKey].push(value);
            } else {
                 // For checkboxes, record true/false instead of 'on'
                const element = form.elements[key];
                if (element && element.type === 'checkbox') {
                    data[key] = element.checked;
                } else {
                    data[key] = value;
                }
            }
        }
        return data;
    };
    
    const setFormData = (data) => {
        form.reset(); // Clear form first
        for (const key in data) {
            const element = form.elements[key];
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = data[key] === true || data[key] === 'true';
                } else {
                    element.value = data[key];
                }
            } else if (key === 'path-to-close' && Array.isArray(data[key])) {
                // Special handling for dynamic 'path-to-close'
                pathToCloseContainer.innerHTML = '';
                data[key].forEach(step => {
                    const div = document.createElement('div');
                    div.className = 'path-item';
                    div.innerHTML = `<input type="text" name="path-to-close[]" value="${step}">`;
                    pathToCloseContainer.appendChild(div);
                });
            }
        }
        updateProgress(); // Update progress bar after loading data
    };

    // --- EVENT LISTENERS ---

    checkboxes.forEach(cb => cb.addEventListener('change', updateProgress));

    addPathStepBtn.addEventListener('click', () => {
        const div = document.createElement('div');
        div.className = 'path-item';
        div.innerHTML = `<input type="text" name="path-to-close[]" placeholder="Enter another step...">`;
        pathToCloseContainer.appendChild(div);
    });
    
    modalCloseBtn.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    });

    // --- API INTERACTIONS ---

    saveBtn.addEventListener('click', async () => {
        const dealData = getFormData();
        const opportunityName = dealData.opportunityName;

        if (!opportunityName) {
            alert('Please enter an Opportunity Name before saving.');
            return;
        }

        if (AIRTABLE_API_KEY === 'YOUR_AIRTABLE_API_KEY') {
            alert('Please configure your Airtable API Key in script.js');
            return;
        }

        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;

        try {
            // First, check if a record with this name already exists
            const searchUrl = `${AIRTABLE_API_URL}?filterByFormula={opportunityName}="${opportunityName}"`;
            const searchRes = await fetch(searchUrl, {
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
            });
            const searchData = await searchRes.json();
            
            let method = 'POST';
            let url = AIRTABLE_API_URL;
            let recordId = null;

            if (searchData.records && searchData.records.length > 0) {
                recordId = searchData.records[0].id;
                method = 'PATCH';
                url = `${AIRTABLE_API_URL}/${recordId}`;
            }

            const body = JSON.stringify({ fields: dealData });
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: body
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Airtable Error: ${error.error.message}`);
            }
            
            alert(`Deal "${opportunityName}" saved successfully!`);

        } catch (error) {
            console.error('Save Error:', error);
            alert(`Failed to save deal. Check console for details. Error: ${error.message}`);
        } finally {
            saveBtn.textContent = 'Save Deal';
            saveBtn.disabled = false;
        }
    });

    loadBtn.addEventListener('click', async () => {
        const opportunityName = prompt("Enter the Opportunity Name to load:");
        if (!opportunityName) return;
        
        if (AIRTABLE_API_KEY === 'YOUR_AIRTABLE_API_KEY') {
            alert('Please configure your Airtable API Key in script.js');
            return;
        }

        loadBtn.textContent = 'Loading...';
        loadBtn.disabled = true;

        try {
            const url = `${AIRTABLE_API_URL}?filterByFormula={opportunityName}="${opportunityName}"&maxRecords=1`;
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
            });

            if (!response.ok) throw new Error('Failed to fetch data from Airtable.');

            const data = await response.json();

            if (data.records && data.records.length > 0) {
                setFormData(data.records[0].fields);
                alert(`Deal "${opportunityName}" loaded successfully!`);
            } else {
                alert(`No deal found with the name "${opportunityName}".`);
            }

        } catch (error) {
            console.error('Load Error:', error);
            alert('Failed to load deal. Check console for details.');
        } finally {
            loadBtn.textContent = 'Load Deal';
            loadBtn.disabled = false;
        }
    });

    analyzeBtn.addEventListener('click', async () => {
        const dealData = getFormData();
        if (!dealData.opportunityName) {
            alert('Please fill out at least the Opportunity Name before analyzing.');
            return;
        }

        analyzeBtn.textContent = 'Analyzing...';
        analyzeBtn.disabled = true;
        aiResponseContainer.innerHTML = 'Thinking... Please wait.';
        modal.style.display = 'block';

        const promptForAI = `
I have provided the following information about my sales opportunity at ScreenCloud. Please identify any key areas that may need additional bolstering and suggest ways that I can get this information.

Here is the data in JSON format:
${JSON.stringify(dealData, null, 2)}
`;
        try {
            const response = await fetch(OPENAI_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: "gpt-4-turbo",
                    messages: [{ "role": "user", "content": promptForAI }],
                    temperature: 0.5
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`OpenAI API Error: ${error.error.message}`);
            }
            
            const result = await response.json();
            aiResponseContainer.textContent = result.choices[0].message.content;

        } catch (error) {
            console.error('AI Analysis Error:', error);
            aiResponseContainer.textContent = `An error occurred while analyzing the deal. Please check the console. \n\nError: ${error.message}`;
        } finally {
            analyzeBtn.textContent = 'Let AI Analyze';
            analyzeBtn.disabled = false;
        }
    });

    // --- INITIALIZATION ---
    updateProgress();
});
