document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURATION ---
    const AIRTABLE_API_KEY = 'YOUR_AIRTABLE_API_KEY';
    const AIRTABLE_BASE_ID = 'YOUR_AIRTABLE_BASE_ID';
    const AIRTABLE_TABLE_NAME = 'YOUR_TABLE_NAME';
    const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`;

    const OPENAI_API_KEY = 'PLACEHOLDERKEY';
    const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

    // --- ELEMENT SELECTORS ---
    const form = document.getElementById('deal-form');
    const checklistItems = Array.from(document.querySelectorAll('#interactive-checklist .checklist-item'));
    const allCheckboxesAndTextareas = document.querySelectorAll('#interactive-checklist input[type="checkbox"], #interactive-checklist textarea');
    
    const progressBarFill = document.getElementById('progress-bar-fill');
    const progressText = document.getElementById('progress-text');
    const progressStatus = document.getElementById('progress-status');

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
        // Get all checklist items that are currently visible on the page
        const visibleItems = checklistItems.filter(item => item.offsetParent !== null);
        const totalCount = visibleItems.length;

        let completedCount = 0;
        // Loop through each visible item to see if it's "complete"
        visibleItems.forEach(item => {
            const checkbox = item.querySelector('input[type="checkbox"]');
            const textarea = item.querySelector('textarea');

            if (checkbox) {
                // If an item has a checkbox, its completion is determined only by the checkbox.
                if (checkbox.checked) {
                    completedCount++;
                }
            } else if (textarea) {
                // If it has NO checkbox but DOES have a textarea, completion is based on the text.
                if (textarea.value.trim() !== '') {
                    completedCount++;
                }
            }
        });
        
        const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        
        // Update the progress bar text and fill width
        progressText.textContent = `${percentage}%`;
        progressBarFill.style.width = `${percentage}%`;

        // Update the status text and color based on the percentage
        const rootStyles = getComputedStyle(document.documentElement);
        if (percentage < 65) {
            progressStatus.textContent = 'Major Risk';
            const color = rootStyles.getPropertyValue('--danger-color').trim();
            progressStatus.style.color = color;
            progressBarFill.style.backgroundColor = color;
        } else if (percentage < 90) {
            progressStatus.textContent = 'Minor Risk';
            const color = rootStyles.getPropertyValue('--warning-color').trim();
            progressStatus.style.color = color;
            progressBarFill.style.backgroundColor = color;
        } else {
            progressStatus.textContent = 'Strong';
            const color = rootStyles.getPropertyValue('--success-color').trim();
            progressStatus.style.color = color;
            progressBarFill.style.backgroundColor = color;
        }
    };
    
    const handleBudgetCheckboxChange = () => {
        if (hasBudgetCheckbox.checked) {
            noBudgetQuestionWrapper.style.display = 'none';
            noBudgetCheckbox.checked = false; 
            noBudgetCheckbox.disabled = true;
        } else {
            noBudgetQuestionWrapper.style.display = 'block';
            noBudgetCheckbox.disabled = false;
        }
        updateProgress();
    };

    const getFormData = () => {
        const data = {};
        const formData = new FormData(form);

        for (let [key, value] of formData.entries()) {
            if (key.endsWith('[]')) {
                const arrayKey = key.slice(0, -2);
                if (!data[arrayKey]) data[arrayKey] = [];
                data[arrayKey].push(value);
            } else {
                data[key] = value;
            }
        }
        
        // Explicitly handle checkboxes to ensure Yes/No status for the AI
        document.querySelectorAll('#interactive-checklist input[type="checkbox"]').forEach(cb => {
            // Only include visible checkboxes in the final data
            if (cb.offsetParent !== null) {
                 data[cb.name] = cb.checked ? 'Yes' : 'No';
            }
        });

        return data;
    };
    
    const setFormData = (data) => {
        form.reset(); 
        for (const key in data) {
            const element = form.elements[key];
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = data[key] === true || data[key] === 'Yes';
                } else {
                    element.value = data[key];
                }
            } else if (key === 'path-to-close' && Array.isArray(data[key])) {
                pathToCloseContainer.innerHTML = '';
                data[key].forEach(step => {
                    if (step) {
                        const div = document.createElement('div');
                        div.className = 'path-item';
                        div.innerHTML = `<input type="text" name="path-to-close[]" value="${step}">`;
                        pathToCloseContainer.appendChild(div);
                    }
                });
            }
        }
        handleBudgetCheckboxChange();
    };

    // --- EVENT LISTENERS ---
    // Add listeners to all interactive checklist elements to trigger progress updates
    allCheckboxesAndTextareas.forEach(el => {
        el.addEventListener('input', updateProgress);
        el.addEventListener('change', updateProgress);
    });
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

        const promptForAI = `Review the submitted information from the deal checklist and spotlight any potential weaknesses and/or missing information, what risks the missing information poses, and suggest how the information could be retrieved or improved.

Here is the deal data:
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
