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

// --- STAKEHOLDER MAP STATE & FUNCTIONS ---
let stakeholderMapData = { nodes: [], links: [] };
let isSelectingManager = false;
let sourceNodeForLink = null;
let activeNode = null;
let offsetX, offsetY;

// Function to render the entire map from data
const renderStakeholderMap = () => {
    stakeholderCanvas.innerHTML = ''; // Clear canvas
    lineCanvas.innerHTML = ''; // Clear lines

    stakeholderMapData.nodes.forEach(nodeData => {
        createNodeElement(nodeData);
    });
    
    // --- ADD THIS LINE ---
    // Use a timeout to ensure nodes are in the DOM before drawing lines
    setTimeout(drawLines, 0);
    // ---------------------
};

// Function to create and append a single stakeholder node
const createNodeElement = (nodeData) => {
    const nodeEl = document.createElement('div');
    nodeEl.className = `stakeholder-node ${nodeData.support}`;
    nodeEl.id = `node-${nodeData.id}`;
    nodeEl.style.left = `${nodeData.x}px`;
    nodeEl.style.top = `${nodeData.y}px`;
    const size = 60 + (nodeData.influence * 15);
    nodeEl.style.width = `${size}px`;
    nodeEl.style.height = `${size}px`;

    // --- We've changed the button text and the function it calls ---
    nodeEl.innerHTML = `
        <div class="node-menu">
            <span onclick="updateSupport('${nodeData.id}', 'supporter')">S</span>
            <span onclick="updateSupport('${nodeData.id}', 'neutral')">N</span>
            <span onclick="updateSupport('${nodeData.id}', 'detractor')">D</span>
            <span onclick="removeNode('${nodeData.id}')">&#10006;</span>
        </div>
        <div class="node-name">${nodeData.name}</div>
        <div class="node-title">${nodeData.title}</div>
        <div class="node-controls">
            <span class="influence-control" onclick="updateInfluence('${nodeData.id}', -1)">&#9660;</span>
            <span class="influence-control" onclick="updateInfluence('${nodeData.id}', 1)">&#9650;</span>
            <span class="add-manager-btn" onclick="initiateReportsTo('${nodeData.id}')">Reports To</span>
        </div>
    `;

    // Add a single click handler for managing the "Reports To" logic
    nodeEl.addEventListener('click', (e) => {
        handleNodeClick(e.currentTarget.id.replace('node-', ''));
    });

    nodeEl.addEventListener('mousedown', onDragStart);
    stakeholderCanvas.appendChild(nodeEl);
};

// --- Node Interaction Functions (must be global for onclick) ---
window.updateInfluence = (nodeId, change) => {
    const node = stakeholderMapData.nodes.find(n => n.id == nodeId);
    if (node) {
        node.influence = Math.max(0, node.influence + change); // Prevent negative influence
        renderStakeholderMap();
    }
};

window.updateSupport = (nodeId, newSupport) => {
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
    // You could also add a class to the body here for more distinct visual feedback
};

const handleNodeClick = (clickedNodeId) => {
    // This function only runs if we are in "select manager" mode
    if (!isSelectingManager) return;

    // Prevent a node from reporting to itself
    if (sourceNodeForLink === clickedNodeId) {
        alert("A stakeholder cannot report to themselves.");
        return;
    }
    
    // Create the link
    stakeholderMapData.links.push({ source: sourceNodeForLink, target: clickedNodeId });

    // Reset the selection state
    isSelectingManager = false;
    sourceNodeForLink = null;
    stakeholderCanvas.style.cursor = 'default';
    
    // Redraw the map to show the new line
    renderStakeholderMap();
};

window.removeNode = (nodeId) => {
    if(confirm('Are you sure you want to remove this stakeholder?')) {
        // Remove the node itself
        stakeholderMapData.nodes = stakeholderMapData.nodes.filter(n => n.id != nodeId);
        
        // --- This new part removes any connections to the deleted node ---
        stakeholderMapData.links = stakeholderMapData.links.filter(l => l.source != nodeId && l.target != nodeId);
        
        renderStakeholderMap();
    }
}

    const drawLines = () => {
    lineCanvas.innerHTML = ''; // Clear old lines

    // Define an arrowhead marker
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
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

        // Calculate center points relative to the canvas
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
}

// --- Drag and Drop Logic ---
const onDragStart = (e) => {
    if (e.target.classList.contains('influence-control') || e.target.classList.contains('add-manager-btn') || e.target.closest('.node-menu')) {
        return; // Don't drag if clicking controls
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

    // Clamp position within the canvas
    x = Math.max(0, Math.min(x, stakeholderCanvas.clientWidth - activeNode.clientWidth));
    y = Math.max(0, Math.min(y, stakeholderCanvas.clientHeight - activeNode.clientHeight));

    activeNode.style.left = `${x}px`;
    activeNode.style.top = `${y}px`;

    // --- ADD THIS LINE ---
    // Redraw lines as the node moves for a live update
    drawLines();
    // ---------------------
};

const onDragEnd = () => {
    if (!activeNode) return;
    const nodeId = activeNode.id.replace('node-', '');
    const nodeData = stakeholderMapData.nodes.find(n => n.id == nodeId);
    if(nodeData) {
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
                // Since the Airtable field is ACTUALLY named with brackets, we use the full key.
                if (!data[key]) data[key] = [];
                data[key].push(value);
            } else {
                // This handles all other standard fields
                data[key] = value;
            }
        }
        
        document.querySelectorAll('#interactive-checklist input[type="checkbox"]').forEach(cb => {
            if (cb.offsetParent !== null) {
                data[cb.name] = cb.checked; // This correctly sends true or false
            }
        });

          // --- ADD THIS LINE ---
            // Stringify the map data to save it as a text field in Airtable
            data.stakeholderMapData = JSON.stringify(stakeholderMapData);
            // ---------------------


        return data;
    };
    
    const setFormData = (data) => {
    form.reset();
    pathToCloseContainer.innerHTML = ''; // Clear path steps initially

    // Reset and load the stakeholder map data
    if (data.stakeholderMapData && data.stakeholderMapData.trim() !== '') {
        try {
            // Parse the stored string back into our map object
            stakeholderMapData = JSON.parse(data.stakeholderMapData);
        } catch (e) {
            console.error("Could not parse stakeholder map data:", e);
            // If data is corrupt or invalid, reset to a blank state
            stakeholderMapData = { nodes: [], links: [] };
        }
    } else {
        // If no map data exists for this deal, reset to a blank state
        stakeholderMapData = { nodes: [], links: [] };
    }

    for (const key in data) {
        if (key === 'path-to-close[]') {
            // This is our special case for the multi-step input
            if (data[key] && typeof data[key] === 'string') {
                const steps = data[key].split('\n');
                steps.forEach(step => {
                    if (step.trim() !== '') {
                        const div = document.createElement('div');
                        div.className = 'path-item';
                        const input = document.createElement('input');
                        input.type = 'text';
                        input.name = 'path-to-close[]';
                        input.value = step; // Safely setting the value
                        div.appendChild(input);
                        pathToCloseContainer.appendChild(div);
                    }
                });
            }
        } else if (key === 'stakeholderMapData') {
            // We have already handled this new field above, so we'll just skip it in this loop.
            continue;
        } else {
            // This handles all other standard fields
            const element = form.elements[key];
            if (element) {
                // Check if it's a NodeList (like for radio buttons), though we don't have them here
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

    // If there were no path steps in the data, add a default empty one
    if (pathToCloseContainer.children.length === 0) {
         const div = document.createElement('div');
         div.className = 'path-item';
         div.innerHTML = `<input type="text" name="path-to-close[]" placeholder="Enter a step...">`;
         pathToCloseContainer.appendChild(div);
    }

    handleBudgetCheckboxChange();
    updateProgress(); // Also call updateProgress after loading data
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
        
        // Convert the 'path-to-close[]' array into a single text block for Airtable
        if (dealData['path-to-close[]'] && Array.isArray(dealData['path-to-close[]'])) {
            // Join the array into a single string, with each step on a new line,
            // and filter out any empty steps the user might have accidentally added.
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

    // When the main "Load Deal" button is clicked, open the modal and populate it
    loadBtn.addEventListener('click', async () => {
        loadDealModal.style.display = 'block';
        loadModalError.textContent = '';
        loadDealSelect.innerHTML = '<option value="">Loading deals...</option>';
        loadDealSelect.disabled = true;
        loadSelectedDealBtn.disabled = true;

        try {
            // We only need the opportunityName field to populate the dropdown. This is more efficient.
            // We also sort the results by name for convenience.
            const url = `${AIRTABLE_API_URL}?fields%5B%5D=opportunityName&sort%5B0%5D%5Bfield%5D=opportunityName&sort%5B0%5D%5Bdirection%5D=asc`;
            const response = await fetch(url, { headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` } });

            if (!response.ok) {
                const errorPayload = await response.json();
                throw new Error(JSON.stringify(errorPayload));
            }

            const data = await response.json();
            loadDealSelect.innerHTML = '<option value="">-- Please select a deal --</option>'; // Clear loading message

            if (data.records && data.records.length > 0) {
                data.records.forEach(record => {
                    // We only add records that have an opportunity name
                    if (record.fields.opportunityName) {
                        const option = document.createElement('option');
                        option.value = record.id; // The value of the option is the Record ID
                        option.textContent = record.fields.opportunityName; // The text is the Opportunity Name
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
    quickViewContent.innerHTML = ''; // Clear previous content

    // Filter for visible fields and create a Set of their names for easy lookup
    const visibleFields = allProgressFields.filter(field => field.offsetParent !== null);
    const visibleFieldNames = new Set(visibleFields.map(field => field.name));

    // We'll process fieldsets to keep the order and grouping logical
    const fieldsets = form.querySelectorAll('fieldset');

    fieldsets.forEach(fieldset => {
        const legend = fieldset.querySelector('legend');
        if (!legend) return;

        // Create a container for the fieldset
        const fieldsetContainer = document.createElement('div');
        fieldsetContainer.style.marginBottom = '20px'; // Add space between groups
        
        const legendTitle = document.createElement('h3');
        legendTitle.textContent = legend.textContent;
        legendTitle.style.marginBottom = '10px';
        legendTitle.style.borderBottom = '1px solid var(--border-color)';
        legendTitle.style.paddingBottom = '5px';
        fieldsetContainer.appendChild(legendTitle);

        const fieldsInSet = Array.from(fieldset.querySelectorAll('input, textarea'));

        fieldsInSet.forEach(field => {
            // Only include fields that are currently visible
            if (!visibleFieldNames.has(field.name)) return;

            // Find the label associated with the input
            const labelEl = field.closest('.input-group, .checklist-item')?.querySelector('label');
            if (!labelEl) return; // Skip if no label is found

            const labelText = labelEl.textContent.trim();
            let isPopulated = false;

            if (field.type === 'checkbox') {
                isPopulated = field.checked;
            } else if (field.value && field.value.trim() !== '') {
                isPopulated = true;
            }
            
            const itemDiv = document.createElement('div');
            itemDiv.className = 'quick-view-item';

            const iconSpan = document.createElement('span');
            iconSpan.className = 'icon';
            
            if (isPopulated) {
                iconSpan.innerHTML = '&#10004;'; // Checkmark
                iconSpan.classList.add('check');
            } else {
                iconSpan.innerHTML = '&#10006;'; // X mark
                iconSpan.classList.add('x');
            }

            const labelSpan = document.createElement('span');
            labelSpan.className = 'label-text';
            labelSpan.textContent = labelText;

            itemDiv.appendChild(iconSpan);
            itemDiv.appendChild(labelSpan);
            fieldsetContainer.appendChild(itemDiv);
        });

        // Only append the container if it has fields in it
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

    // Get all currently visible fields
    const visibleFields = allProgressFields.filter(field => field.offsetParent !== null);

    if (isActive) {
        // If active, turn it off and remove all highlights
        showGapsBtn.textContent = 'Show Gaps';
        showGapsBtn.dataset.active = 'false';
        showGapsBtn.style.backgroundColor = 'var(--warning-color)';
        
        // Remove the class from any element that has it
        const highlightedElements = form.querySelectorAll('.highlight-gap');
        highlightedElements.forEach(el => el.classList.remove('highlight-gap'));

    } else {
        // If inactive, turn it on and add highlights
        showGapsBtn.textContent = 'Hide Gaps';
        showGapsBtn.dataset.active = 'true';
        showGapsBtn.style.backgroundColor = '#2D3748'; // Darker color when active

        visibleFields.forEach(field => {
            let isGap = false;
            let elementToHighlight = field;

            if (field.type === 'checkbox') {
                if (!field.checked) {
                    isGap = true;
                    // For checkboxes, highlight the parent container for better visibility
                    const parentItem = field.closest('.checklist-item');
                    if(parentItem) elementToHighlight = parentItem;
                }
            } else {
                if (!field.value || field.value.trim() === '') {
                    isGap = true;
                }
            }
            
            if (isGap) {
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
        const promptForAI = `
You are an elite-level CRO (Chief Revenue Officer) at a top SaaS company, renowned for your sharp, insightful deal coaching. You are reviewing a deal for 'ScreenCloud', a digital signage solution. Your task is to go far beyond a surface-level review. You must synthesize the information provided, connect the dots between different data points, identify subtle risks, and provide a concrete, strategic action plan. Your advice should be the kind that turns a stalled deal into a closed-won opportunity.

Use the MEDDPICC sales qualification framework (Metrics, Economic Buyer, Decision Criteria, Decision Process, Paper Process, Identify Pain, Champion, Competition) as the mental model for your analysis of the data provided below.

Provide your coaching in the following, highly structured format:

**1. The Big Picture (Executive Summary):**
* Start with a concise, one-sentence summary of the deal's current state and your confidence level.
* *Example: "This deal has a strong champion and clear pain points, but a poorly defined decision process and lack of economic buyer engagement puts the projected close date at high risk."*

**2. Red Flags & Strategic Gaps:**
* Go beyond just listing empty fields. For each point, create a synthesis of multiple data points from the submitted information. Explain the **strategic implication** of each red flag. Prioritize this list from most to least critical.
* *Example Insight: "You've listed 'IT/Cybersecurity' as a stakeholder but haven't specified if our security documentation has been reviewed. Given the 'Projected Close Date' is just 3 weeks away, an unaddressed security review is the single most likely reason this deal will slip."*

**3. Green Flags & Untapped Leverage:**
* What are the core strengths of this deal that can be amplified? How can we use these strengths to mitigate the risks you identified above?
* *Example Insight: "The 'Compelling Reason to Act' is a new office opening. You must use this date as a forcing function in every conversation. Frame every request and next step around the shared goal of hitting that deadline."*

**4. Strategic Coaching & Action Plan:**
* Provide a list of highly specific, productive next steps. For each action, explain the **"Why"** – what risk it mitigates or what critical information it will uncover. These should be strategic moves, not just simple tasks.
* *Example Action: "Action: Co-author a 'Mutual Close Plan' with your Champion, outlining every step from today until the go-live date. **Why:** This isn't a document for you; it's a tool to test your Champion and expose gaps. It will immediately reveal if they truly know the required procurement (Paper Process) and sign-off (Decision Process) stages."*
* *Example Action: "Action: Ask your Champion, 'Who besides yourself is most negatively impacted by the business pains you mentioned?' **Why:** This is a tactical question to help you multi-thread to other potential allies. It validates the pain while expanding your influence beyond a single point of contact."*

Here is the deal data to analyze:
${JSON.stringify(dealData, null, 2)}
`;
        try {
            // The URL now points to our own secure function, not OpenAI
            // The secret key is GONE from the front-end code
            const response = await fetch('/.netlify/functions/analyze-deal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ promptForAI: promptForAI }) // Send the prompt data
            });

            const result = await response.json();
            
            if (!response.ok) {
                // The serverless function will pass along the error message
                throw new Error(result.error || 'The analysis failed.');
            }
            
            aiResponseContainer.textContent = result.choices[0].message.content;

        } catch (error) {
            console.error('AI Analysis Error:', error);
            aiResponseContainer.textContent = `An error occurred while analyzing the deal. Please check the console. \n\nError: ${error.message}`;
        } finally {
            analyzeBtn.textContent = 'Let AI Analyze';
            analyzeBtn.disabled = false;
        }
    });

    // --- Stakeholder Map Event Listeners ---
stakeholderMapBtn.addEventListener('click', () => {
    stakeholderMapModal.style.display = 'block';
    renderStakeholderMap(); // Re-render in case data was loaded
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

// NOTE: You will need to update your save/load functions to handle the 'stakeholderMapData'
// by stringifying it to a new field in Airtable and parsing it back on load.

    // --- LOGIC FOR THE LOAD DEAL MODAL ---
    // MOVED TO BE INSIDE THE DOMCONTENTLOADED WRAPPER

    // When the "Load Selected Deal" button inside the modal is clicked
    loadSelectedDealBtn.addEventListener('click', async () => {
        const recordId = loadDealSelect.value;
        if (!recordId) {
            alert('Please select a deal from the list.');
            return;
        }

        loadSelectedDealBtn.textContent = 'Loading...';
        loadSelectedDealBtn.disabled = true;

        try {
            const url = `${AIRTABLE_API_URL}/${recordId}`; // Fetch a single record by its ID
            const response = await fetch(url, { headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` } });

            if (!response.ok) {
                const errorPayload = await response.json();
                throw new Error(JSON.stringify(errorPayload));
            }

            const data = await response.json();
            setFormData(data.fields); // Use our existing function to fill the form
            alert(`Deal "${data.fields.opportunityName}" loaded successfully!`);
            loadDealModal.style.display = 'none'; // Close the modal on success

        } catch (error) {
            console.error('Load Error:', error);
            loadModalError.textContent = `Failed to load deal. ${error.message}`;
        } finally {
            loadSelectedDealBtn.textContent = 'Load Selected Deal';
            loadSelectedDealBtn.disabled = false;
        }
    });

    // Logic to close the modal
    loadModalCloseBtn.addEventListener('click', () => {
        loadDealModal.style.display = 'none';
    });


    // --- INITIALIZATION ---
    handleBudgetCheckboxChange();
    
});
