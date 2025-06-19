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

    const loadDealModal = document.getElementById('load-deal-modal');
    const loadModalCloseBtn = document.getElementById('load-modal-close-btn');
    const loadDealSelect = document.getElementById('load-deal-select');
    const loadSelectedDealBtn = document.getElementById('load-selected-deal-btn');
    const loadModalError = document.getElementById('load-modal-error');

    const quickViewBtn = document.getElementById('quick-view-btn');
    const quickViewModal = document.getElementById('quick-view-modal');
    const quickViewModalCloseBtn = document.getElementById('quick-view-modal-close-btn');
    const quickViewContent = document.getElementById('quick-view-content');

    const showGapsBtn = document.getElementById('show-gaps-btn');

    const stakeholderMapBtn = document.getElementById('stakeholder-map-btn');
    const stakeholderMapModal = document.getElementById('stakeholder-map-modal');
    const stakeholderMapCloseBtn = document.getElementById('stakeholder-map-close-btn');
    const stakeholderCanvas = document.getElementById('stakeholder-canvas');
    const lineCanvas = document.getElementById('line-canvas');
    const addStakeholderBtn = document.getElementById('add-stakeholder-btn');
    const toggleControlsBtn = document.getElementById('toggle-controls-btn');

    // --- STAKEHOLDER MAP STATE & FUNCTIONS ---
    let stakeholderMapData = { nodes: [], links: [] };
    let isSelectingManager = false;
    let sourceNodeForLink = null;
    let activeNode = null;
    let offsetX, offsetY;

    // --- Node Interaction Functions ---
    const updateInfluence = (nodeId, change) => {
        const node = stakeholderMapData.nodes.find(n => n.id == nodeId);
        if (node) {
            node.influence = Math.max(0, node.influence + change); // Prevent negative influence
            renderStakeholderMap();
        }
    };

    const updateSupport = (nodeId, newSupport) => {
        const node = stakeholderMapData.nodes.find(n => n.id == nodeId);
        if (node) {
            node.support = newSupport;
            renderStakeholderMap();
        }
    };

    const initiateReportsTo = (nodeId) => {
        isSelectingManager = true;
        sourceNodeForLink = nodeId;
        stakeholderCanvas.style.cursor = 'crosshair';
        alert(`Selecting manager for this node. Click another stakeholder who this person reports to.`);
    };
    
    const handleNodeClick = (clickedNodeId) => {
        if (!isSelectingManager) return;
        if (sourceNodeForLink === clickedNodeId) {
            alert("A stakeholder cannot report to themselves.");
            return;
        }
        stakeholderMapData.links.push({ source: sourceNodeForLink, target: clickedNodeId });
        isSelectingManager = false;
        sourceNodeForLink = null;
        stakeholderCanvas.style.cursor = 'default';
        renderStakeholderMap();
    };

    const removeNode = (nodeId) => {
        if (confirm('Are you sure you want to remove this stakeholder?')) {
            stakeholderMapData.nodes = stakeholderMapData.nodes.filter(n => n.id != nodeId);
            stakeholderMapData.links = stakeholderMapData.links.filter(l => l.source != nodeId && l.target != nodeId);
            renderStakeholderMap();
        }
    }

    const createNodeElement = (nodeData) => {
        const nodeEl = document.createElement('div');
        nodeEl.className = `stakeholder-node ${nodeData.support}`;
        nodeEl.id = `node-${nodeData.id}`;
        nodeEl.style.left = `${nodeData.x}px`;
        nodeEl.style.top = `${nodeData.y}px`;
        const size = 60 + (nodeData.influence * 15);
        nodeEl.style.width = `${size}px`;
        nodeEl.style.height = `${size}px`;

        nodeEl.innerHTML = `
            <div class="node-menu">
                <span data-action="support" data-value="supporter">S</span>
                <span data-action="support" data-value="neutral">N</span>
                <span data-action="support" data-value="detractor">D</span>
                <span data-action="remove">&#10006;</span>
            </div>
            <div class="node-name">${nodeData.name}</div>
            <div class="node-title">${nodeData.title}</div>
            <div class="node-controls">
                <span data-action="influence" data-value="-1">&#9660;</span>
                <span data-action="influence" data-value="1">&#9650;</span>
                <span data-action="reports-to">Reports To</span>
            </div>
        `;

        // *** THIS IS THE MAJOR FIX ***
        // A single, powerful event listener for each node.
        nodeEl.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (!action) {
                // If the click is not on a specific button, it's for selecting a manager
                handleNodeClick(nodeData.id);
                return;
            }

            e.stopPropagation(); // Stop the click from bubbling up further

            if (action === 'support') {
                updateSupport(nodeData.id, e.target.dataset.value);
            } else if (action === 'influence') {
                updateInfluence(nodeData.id, parseInt(e.target.dataset.value, 10));
            } else if (action === 'remove') {
                removeNode(nodeData.id);
            } else if (action === 'reports-to') {
                initiateReportsTo(nodeData.id);
            }
        });

        nodeEl.addEventListener('mousedown', onDragStart);
        stakeholderCanvas.appendChild(nodeEl);
    };
    
    const renderStakeholderMap = () => {
        stakeholderCanvas.innerHTML = '';
        stakeholderMapData.nodes.forEach(nodeData => {
            createNodeElement(nodeData);
        });
        setTimeout(drawLines, 0);
    };

    const drawLines = () => {
    lineCanvas.innerHTML = ''; // Clear old lines

    // Define an arrowhead marker
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    // FIX: Added a fill attribute to the path to make the arrowhead visible
    defs.innerHTML = `
        <marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5"
            markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#888"></path>
        </marker>
    `;
    lineCanvas.appendChild(defs);

    stakeholderMapData.links.forEach(link => {
        const sourceNodeEl = document.getElementById(`node-${link.source}`);
        const targetNodeEl = document.getElementById(`node-${link.target}`);

        if (!sourceNodeEl || !targetNodeEl) return;

        const sourceRect = sourceNodeEl.getBoundingClientRect();
        const targetRect = targetNodeEl.getBoundingClientRect();
        const canvasRect = stakeholderCanvas.getBoundingClientRect();

        const x1 = (sourceRect.left - canvasRect.left) + (sourceRect.width / 2);
        const y1 = (sourceRect.top - canvasRect.top) + (sourceRect.height / 2);
        const x2 = (targetRect.left - canvasRect.left) + (targetRect.width / 2);
        const y2 = (targetRect.top - canvasRect.top) + (targetRect.height / 2);

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', '#888');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('marker-end', 'url(#arrowhead)');
        lineCanvas.appendChild(line);
    });
};

    // --- Drag and Drop Logic ---
    const onDragStart = (e) => {
        if (e.target.dataset.action) { // Check for any button with a data-action
            return;
        }
        e.preventDefault();
        activeNode = e.currentTarget;
        offsetX = e.clientX - activeNode.getBoundingClientRect().left;
        offsetY = e.clientY - activeNode.getBoundingClientRect().top;
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', onDragEnd);
    };

    const onDrag = (e) => {
        if (!activeNode) return;
        const canvasRect = stakeholderCanvas.getBoundingClientRect();
        let x = e.clientX - canvasRect.left - offsetX;
        let y = e.clientY - canvasRect.top - offsetY;

        x = Math.max(0, Math.min(x, stakeholderCanvas.clientWidth - activeNode.clientWidth));
        y = Math.max(0, Math.min(y, stakeholderCanvas.clientHeight - activeNode.clientHeight));

        activeNode.style.left = `${x}px`;
        activeNode.style.top = `${y}px`;
        drawLines();
    };

    const onDragEnd = () => {
        if (!activeNode) return;
        const nodeId = activeNode.id.replace('node-', '');
        const nodeData = stakeholderMapData.nodes.find(n => n.id == nodeId);
        if (nodeData) {
            nodeData.x = parseInt(activeNode.style.left, 10);
            nodeData.y = parseInt(activeNode.style.top, 10);
        }
        activeNode = null;
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', onDragEnd);
    };
    
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
                if (!data[key]) data[key] = [];
                data[key].push(value);
            } else {
                data[key] = value;
            }
        }
        
        document.querySelectorAll('#interactive-checklist input[type="checkbox"]').forEach(cb => {
            if (cb.offsetParent !== null) {
                data[cb.name] = cb.checked;
            }
        });

        data.stakeholderMapData = JSON.stringify(stakeholderMapData);
        return data;
    };
    
    const setFormData = (data) => {
        form.reset();
        pathToCloseContainer.innerHTML = '';

        if (data.stakeholderMapData && data.stakeholderMapData.trim() !== '') {
            try {
                stakeholderMapData = JSON.parse(data.stakeholderMapData);
            } catch (e) {
                console.error("Could not parse stakeholder map data:", e);
                stakeholderMapData = { nodes: [], links: [] };
            }
        } else {
            stakeholderMapData = { nodes: [], links: [] };
        }

        for (const key in data) {
            if (key === 'path-to-close[]') {
                if (data[key] && typeof data[key] === 'string') {
                    const steps = data[key].split('\n');
                    steps.forEach(step => {
                        if (step.trim() !== '') {
                            const div = document.createElement('div');
                            div.className = 'path-item';
                            const input = document.createElement('input');
                            input.type = 'text';
                            input.name = 'path-to-close[]';
                            input.value = step;
                            div.appendChild(input);
                            pathToCloseContainer.appendChild(div);
                        }
                    });
                }
            } else if (key === 'stakeholderMapData') {
                continue;
            } else {
                const element = form.elements[key];
                if (element) {
                    if (element.length && !element.tagName) {
                         // Logic for radio button group would go here if needed
                    } else if (element.type === 'checkbox') {
                        element.checked = data[key] === true || data[key] === 'Yes';
                    } else {
                        element.value = data[key];
                    }
                }
            }
        }

        if (pathToCloseContainer.children.length === 0) {
             const div = document.createElement('div');
             div.className = 'path-item';
             div.innerHTML = `<input type="text" name="path-to-close[]" placeholder="Enter a step...">`;
             pathToCloseContainer.appendChild(div);
        }

        handleBudgetCheckboxChange();
        updateProgress();
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

    saveBtn.addEventListener('click', async () => {
        const dealData = getFormData();
        const opportunityName = dealData.opportunityName;
        
        if (dealData.closeDate === '') delete dealData.closeDate;
        if (dealData.arr === '') delete dealData.arr;
        else dealData.arr = parseInt(dealData.arr, 10);
        if (dealData.screens === '') delete dealData.screens;
        else dealData.screens = parseInt(dealData.screens, 10);
        
        if (dealData['path-to-close[]'] && Array.isArray(dealData['path-to-close[]'])) {
            dealData['path-to-close[]'] = dealData['path-to-close[]']
                .filter(step => step.trim() !== '')
                .join('\n');
        }
        
        if (!opportunityName) {
            alert('Please enter an Opportunity Name before saving.');
            return;
        }
        
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;

        try {
            const searchUrl = `${AIRTABLE_API_URL}?filterByFormula={opportunityName}="${opportunityName}"`;
            const searchRes = await fetch(searchUrl, { headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` } });
            
            if (!searchRes.ok) throw new Error(JSON.stringify(await searchRes.json()));
            
            const searchData = await searchRes.json();
            
            let method = 'POST';
            let recordsPayload;

            if (searchData.records && searchData.records.length > 0) {
                method = 'PATCH';
                recordsPayload = {
                    records: [{
                        id: searchData.records[0].id,
                        fields: dealData
                    }]
                };
            } else {
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

            if (!response.ok) throw new Error(JSON.stringify(await response.json()));
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
        loadDealModal.style.display = 'block';
        loadModalError.textContent = '';
        loadDealSelect.innerHTML = '<option value="">Loading deals...</option>';
        loadDealSelect.disabled = true;
        loadSelectedDealBtn.disabled = true;

        try {
            const url = `${AIRTABLE_API_URL}?fields%5B%5D=opportunityName&sort%5B0%5D%5Bfield%5D=opportunityName&sort%5B0%5D%5Bdirection%5D=asc`;
            const response = await fetch(url, { headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` } });

            if (!response.ok) throw new Error(JSON.stringify(await response.json()));

            const data = await response.json();
            loadDealSelect.innerHTML = '<option value="">-- Please select a deal --</option>';

            if (data.records && data.records.length > 0) {
                data.records.forEach(record => {
                    if (record.fields.opportunityName) {
                        const option = document.createElement('option');
                        option.value = record.id;
                        option.textContent = record.fields.opportunityName;
                        loadDealSelect.appendChild(option);
                    }
                });
                loadDealSelect.disabled = false;
                loadSelectedDealBtn.disabled = false;
            } else {
                loadDealSelect.innerHTML = '<option value="">-- No deals found --</option>';
            }

        } catch (error) {
            console.error('Error fetching deal list:', error);
            loadModalError.textContent = `Failed to load deal list. ${error.message}`;
        }
    });
    
    quickViewBtn.addEventListener('click', () => {
        quickViewContent.innerHTML = '';
        const visibleFields = allProgressFields.filter(field => field.offsetParent !== null);
        const visibleFieldNames = new Set(visibleFields.map(field => field.name));
        const fieldsets = form.querySelectorAll('fieldset');

        fieldsets.forEach(fieldset => {
            const legend = fieldset.querySelector('legend');
            if (!legend) return;

            const fieldsetContainer = document.createElement('div');
            fieldsetContainer.style.marginBottom = '20px';
            
            const legendTitle = document.createElement('h3');
            legendTitle.textContent = legend.textContent;
            legendTitle.style.marginBottom = '10px';
            legendTitle.style.borderBottom = '1px solid var(--border-color)';
            legendTitle.style.paddingBottom = '5px';
            fieldsetContainer.appendChild(legendTitle);

            const fieldsInSet = Array.from(fieldset.querySelectorAll('input, textarea'));
            fieldsInSet.forEach(field => {
                if (!visibleFieldNames.has(field.name)) return;
                const labelEl = field.closest('.input-group, .checklist-item')?.querySelector('label');
                if (!labelEl) return;

                const labelText = labelEl.textContent.trim();
                let isPopulated = (field.type === 'checkbox') ? field.checked : (field.value && field.value.trim() !== '');
                
                const itemDiv = document.createElement('div');
                itemDiv.className = 'quick-view-item';
                const iconSpan = document.createElement('span');
                iconSpan.className = 'icon';
                
                if (isPopulated) {
                    iconSpan.innerHTML = '&#10004;';
                    iconSpan.classList.add('check');
                } else {
                    iconSpan.innerHTML = '&#10006;';
                    iconSpan.classList.add('x');
                }

                const labelSpan = document.createElement('span');
                labelSpan.className = 'label-text';
                labelSpan.textContent = labelText;

                itemDiv.appendChild(iconSpan);
                itemDiv.appendChild(labelSpan);
                fieldsetContainer.appendChild(itemDiv);
            });

            if(fieldsetContainer.querySelector('.quick-view-item')) {
                quickViewContent.appendChild(fieldsetContainer);
            }
        });
        quickViewModal.style.display = 'block';
    });

    quickViewModalCloseBtn.addEventListener('click', () => {
        quickViewModal.style.display = 'none';
    });

    showGapsBtn.addEventListener('click', () => {
        const isActive = showGapsBtn.dataset.active === 'true';
        const visibleFields = allProgressFields.filter(field => field.offsetParent !== null);

        if (isActive) {
            showGapsBtn.textContent = 'Show Gaps';
            showGapsBtn.dataset.active = 'false';
            showGapsBtn.style.backgroundColor = 'var(--warning-color)';
            const highlightedElements = form.querySelectorAll('.highlight-gap');
            highlightedElements.forEach(el => el.classList.remove('highlight-gap'));
        } else {
            showGapsBtn.textContent = 'Hide Gaps';
            showGapsBtn.dataset.active = 'true';
            showGapsBtn.style.backgroundColor = '#2D3748';
            visibleFields.forEach(field => {
                let isGap = (field.type === 'checkbox') ? !field.checked : (!field.value || field.value.trim() === '');
                if (isGap) {
                    let elementToHighlight = field;
                    if (field.type === 'checkbox') {
                        const parentItem = field.closest('.checklist-item');
                        if (parentItem) elementToHighlight = parentItem;
                    }
                    elementToHighlight.classList.add('highlight-gap');
                }
            });
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
        const promptForAI = `...`; // Prompt removed for brevity
        try {
            const response = await fetch('/.netlify/functions/analyze-deal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ promptForAI: promptForAI })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'The analysis failed.');
            aiResponseContainer.textContent = result.choices[0].message.content;
        } catch (error) {
            console.error('AI Analysis Error:', error);
            aiResponseContainer.textContent = `An error occurred. Error: ${error.message}`;
        } finally {
            analyzeBtn.textContent = 'Let AI Analyze';
            analyzeBtn.disabled = false;
        }
    });

    // --- Stakeholder Map Event Listeners ---
    stakeholderMapBtn.addEventListener('click', () => {
        stakeholderMapModal.style.display = 'block';
        renderStakeholderMap();
    });

    stakeholderMapCloseBtn.addEventListener('click', () => {
        stakeholderMapModal.style.display = 'none';
    });

    addStakeholderBtn.addEventListener('click', () => {
        const nameInput = document.getElementById('new-stakeholder-name');
        const titleInput = document.getElementById('new-stakeholder-title');
        if (nameInput.value.trim() === '') {
            alert('Please enter a name.');
            return;
        }
        const newNode = {
            id: Date.now().toString(),
            name: nameInput.value.trim(),
            title: titleInput.value.trim(),
            support: 'neutral',
            influence: 1,
            x: 50,
            y: 50
        };
        stakeholderMapData.nodes.push(newNode);
        nameInput.value = '';
        titleInput.value = '';
        renderStakeholderMap();
    });

    toggleControlsBtn.addEventListener('click', () => {
    stakeholderCanvas.classList.toggle('controls-hidden');
});

    loadSelectedDealBtn.addEventListener('click', async () => {
        const recordId = loadDealSelect.value;
        if (!recordId) {
            alert('Please select a deal from the list.');
            return;
        }
        loadSelectedDealBtn.textContent = 'Loading...';
        loadSelectedDealBtn.disabled = true;
        try {
            const url = `${AIRTABLE_API_URL}/${recordId}`;
            const response = await fetch(url, { headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` } });
            if (!response.ok) throw new Error(JSON.stringify(await response.json()));
            const data = await response.json();
            setFormData(data.fields);
            alert(`Deal "${data.fields.opportunityName}" loaded successfully!`);
            loadDealModal.style.display = 'none';
        } catch (error) {
            console.error('Load Error:', error);
            loadModalError.textContent = `Failed to load deal. ${error.message}`;
        } finally {
            loadSelectedDealBtn.textContent = 'Load Selected Deal';
            loadSelectedDealBtn.disabled = false;
        }
    });

    loadModalCloseBtn.addEventListener('click', () => {
        loadDealModal.style.display = 'none';
    });

    // --- INITIALIZATION ---
    handleBudgetCheckboxChange();
});
