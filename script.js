document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURATION ---
    const AIRTABLE_API_KEY = 'YOUR_AIRTABLE_API_KEY';
    const AIRTABLE_BASE_ID = 'YOUR_AIRTABLE_BASE_ID';
    const AIRTABLE_TABLE_NAME = 'YOUR_TABLE_NAME';
    const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`;

    const OPENAI_API_KEY = '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';
    const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

    // --- ELEMENT SELECTORS ---
    const form = document.getElementById('deal-form');
    const allCheckboxes = Array.from(document.querySelectorAll('#interactive-checklist input[type="checkbox"]'));
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

    // Conditional Question Elements
    const hasBudgetCheckbox = form.elements['chk_hasBudget'];
    const noBudgetQuestionWrapper = document.getElementById('no-budget-question-wrapper');
    const noBudgetCheckbox = form.elements['chk_economicBuyerCanSecureFunds'];

    // --- CORE FUNCTIONS ---

    const updateProgress = () => {
        // Filter for only visible checkboxes to calculate progress
        const visibleCheckboxes = allCheckboxes.filter(cb => {
            return cb.offsetParent !== null; // A simple and effective way to check for visibility
        });
        const checkedCount = visibleCheckboxes.filter(cb => cb.checked).length;
        const totalCount = visibleCheckboxes.length;
        const percentage = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
        
        progressBarFill.style.width = `${percentage}%`;
        progressText.textContent = `${percentage}%`;
    };
    
    const handleBudgetCheckboxChange = () => {
        if (hasBudgetCheckbox.checked) {
            noBudgetQuestionWrapper.style.display = 'none';
            noBudgetCheckbox.checked = false; 
            noBudgetCheckbox.disabled = true; // Disable it when hidden
        } else {
            noBudgetQuestionWrapper.style.display = 'block';
            noBudgetCheckbox.disabled = false; // Re-enable it when visible
        }
        // Recalculate progress any time the visibility changes
        updateProgress();
    };

    const getFormData = () => {
        const formData = new FormData(form);
        const data = {};
        for (let [key, value] of formData.entries()) {
            if (key.endsWith('[]')) {
                const arrayKey = key.slice(0, -2);
                if (!data[arrayKey]) data[arrayKey] = [];
                data[arrayKey].push(value);
            } else {
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
        form.reset(); 
        for (const key in data) {
            const element = form.elements[key];
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = data[key] === true || data[key] === 'true';
                } else {
                    element.value = data[key];
                }
            } else if (key === 'path-to-close' && Array.isArray(data[key])) {
                pathToCloseContainer.innerHTML = '';
                data[key].forEach(step => {
                    const div = document.createElement('div');
                    div.className = 'path-item';
                    div.innerHTML = `<input type="text" name="path-to-close[]" value="${step}">`;
                    pathToCloseContainer.appendChild(div);
                });
            }
        }
        // After loading data, ensure conditional visibility is correct
        handleBudgetCheckboxChange(); 
    };

    // --- EVENT LISTENERS ---

    allCheckboxes.forEach(cb => cb.addEventListener('change', updateProgress));
    hasBudgetCheckbox.addEventListener('change', handleBudgetCheckboxChange);

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

    // --- API INTERACTIONS (UNCHANGED) ---

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
            const searchUrl = `${AIRTABLE_API_URL}?filterByFormula={opportunityName}="${opportunityName}"`;
            const searchRes = await fetch(searchUrl, { headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` } });
            const searchData = await searchRes.json();
            
            let method = 'POST';
            let url = AIRTABLE_API_URL;
            if (searchData.records && searchData.records.length > 0) {
                const recordId = searchData.records[0].id;
                method = 'PATCH';
                url = `${AIRTABLE_API_URL}/${recordId}`;
            }

            const body = JSON.stringify({ fields: dealData });
            const response = await fetch(url, {
                method: method,
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' },
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
            const response = await fetch(url, { headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` } });
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
                headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
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
    // Run on page load to set the initial state correctly.
    handleBudgetCheckboxChange();
});
