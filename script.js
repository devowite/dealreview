document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURATION ---
    const AIRTABLE_API_KEY = 'patJxOmigJwrvtgTd.28e49bbd537cfa9b126dfd2158d554f105293edc2a13524718f2eb0b2d4e4d08';
    const AIRTABLE_BASE_ID = 'appyia5p2EHag1uhd';
    const AIRTABLE_TABLE_NAME = 'Deals';
    const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`;

    const OPENAI_API_KEY = 'PLACEHOLDERKEY';
    const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

   // --- ELEMENT SELECTORS ---
    const form = document.getElementById('deal-form');
    const allProgressFields = Array.from(form.querySelectorAll('input[type="text"], input[type="number"], input[type="date"], input[type="checkbox"], textarea'));
    
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

    const hasBudgetCheckbox = form.elements['chk_hasBudget'];
    const noBudgetQuestionWrapper = document.getElementById('no-budget-question-wrapper');

    // --- CORE FUNCTIONS ---
    const updateProgress = () => {
        const visibleFields = allProgressFields.filter(field => field.offsetParent !== null);
        const totalCount = visibleFields.length;
        let completedCount = 0;
        visibleFields.forEach(field => {
            if (field.type === 'checkbox') {
                if (field.checked) {
                    completedCount++;
                }
            } else {
                if (field.value && field.value.trim() !== '') {
                    completedCount++;
                }
            }
        });
        
        const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        
        progressText.textContent = `${percentage}%`;
        progressBarFill.style.width = `${percentage}%`;

        if (percentage < 65) {
            progressStatus.textContent = 'Major Risk';
            progressBarFill.style.backgroundColor = 'var(--danger-color)';
            progressStatus.style.color = 'var(--danger-color)';
        } else if (percentage < 90) {
            progressStatus.textContent = 'Minor Risk';
            progressBarFill.style.backgroundColor = 'var(--warning-color)';
            progressStatus.style.color = 'var(--warning-color)';
        } else {
            progressStatus.textContent = 'Strong';
            progressBarFill.style.backgroundColor = 'var(--success-color)';
            progressStatus.style.color = 'var(--success-color)';
        }
    };
    
    const handleBudgetCheckboxChange = () => {
        if (hasBudgetCheckbox.checked) {
            noBudgetQuestionWrapper.style.display = 'none';
        } else {
            noBudgetQuestionWrapper.style.display = 'block';
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
        
        document.querySelectorAll('#interactive-checklist input[type="checkbox"]').forEach(cb => {
    if (cb.offsetParent !== null) {
         data[cb.name] = cb.checked; // This correctly sends true or false
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
    form.addEventListener('input', (event) => {
        if (event.target === hasBudgetCheckbox) {
            handleBudgetCheckboxChange();
        } else {
            updateProgress();
        }
    });

    addPathStepBtn.addEventListener('click', () => {
        const div = document.createElement('div');
        div.innerHTML = `<input type="text" name="path-to-close[]" placeholder="Enter another step...">`;
        pathToCloseContainer.appendChild(div);
        updateProgress();
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
        
    // Clean up and format data for the API
    if (dealData.closeDate === '') {
        delete dealData.closeDate;
    }

    // For 'arr', delete if empty, otherwise convert to a number.
    if (dealData.arr === '') {
        delete dealData.arr;
    } else {
        dealData.arr = parseInt(dealData.arr, 10);
    }

    // For 'screens', delete if empty, otherwise convert to a number.
    if (dealData.screens === '') {
        delete dealData.screens;
    } else {
        dealData.screens = parseInt(dealData.screens, 10);
    }

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
            // First, try to find an existing record to update
            const searchUrl = `${AIRTABLE_API_URL}?filterByFormula={opportunityName}="${opportunityName}"`;
            const searchRes = await fetch(searchUrl, { headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` } });
            
            if (!searchRes.ok) {
                const errorPayload = await searchRes.json();
                throw new Error(JSON.stringify(errorPayload));
            }
            
            const searchData = await searchRes.json();
            
            let method = 'POST';
            let recordsPayload;

            if (searchData.records && searchData.records.length > 0) {
                // Record exists, so we will UPDATE (PATCH) it
                method = 'PATCH';
                recordsPayload = {
                    records: [{
                        id: searchData.records[0].id,
                        fields: dealData
                    }]
                };
            } else {
                // Record does not exist, so we will CREATE (POST) a new one
                method = 'POST';
                recordsPayload = {
                    records: [{
                        fields: dealData
                    }]
                };
            }

            const response = await fetch(AIRTABLE_API_URL, {
                method: method,
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(recordsPayload)
            });

            if (!response.ok) {
                const errorPayload = await response.json();
                throw new Error(JSON.stringify(errorPayload));
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
        // This function remains largely the same but with improved error handling
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
            
            if (!response.ok) {
                const errorPayload = await response.json();
                throw new Error(JSON.stringify(errorPayload));
            }
            
            const data = await response.json();

            if (data.records && data.records.length > 0) {
                setFormData(data.records[0].fields);
                alert(`Deal "${opportunityName}" loaded successfully!`);
            } else {
                alert(`No deal found with the name "${opportunityName}".`);
            }
        } catch (error) {
            console.error('Load Error:', error);
            alert(`Failed to load deal. Check console for details. Error: ${error.message}`);
        } finally {
            loadBtn.textContent = 'Load Deal';
            loadBtn.disabled = false;
        }
    });
    
    // Analyze function remains unchanged
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
        const promptForAI = `Review the submitted information from the deal checklist and spotlight any potential weaknesses and/or missing information, what risks the missing information poses, and suggest how the information could be retrieved or improved.\n\nHere is the deal data:\n${JSON.stringify(dealData, null, 2)}`;
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
    handleBudgetCheckboxChange();
});
