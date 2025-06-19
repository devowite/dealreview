document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURATION ---
    const AIRTABLE_API_KEY = 'patJxOmigJwrvtgTd.28e49bbd537cfa9b126dfd2158d554f105293edc2a13524718f2eb0b2d4e4d08';
    const AIRTABLE_BASE_ID = 'appyia5p2EHag1uhd';
    const AIRTABLE_TABLE_NAME = 'Deals';
    const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`;

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

    // --- STAKEHOLDER MAP STATE & FUNCTIONS (FINAL VERSION) ---
let stakeholderMapData = { nodes: [], links: [] };
let isSelectingManager = false;
let sourceNodeForLink = null;
let activeNode = null;
let offsetX, offsetY;

const updateInfluence = (nodeId, change) => {
    const node = stakeholderMapData.nodes.find(n => n.id === nodeId);
    if (node) {
        node.influence = Math.max(0, node.influence + change);
        renderStakeholderMap();
    }
};

const updateSupport = (nodeId, newSupport) => {
    const node = stakeholderMapData.nodes.find(n => n.id === nodeId);
    if (node) {
        node.support = newSupport;
        renderStakeholderMap();
    }
};

const initiateReportsTo = (nodeId) => {
    isSelectingManager = true;
    sourceNodeForLink = nodeId;
    stakeholderCanvas.style.cursor = 'crosshair';
    alert(`Select the manager that this person reports to.`);
};

const removeNode = (nodeId) => {
    if (confirm('Are you sure you want to remove this stakeholder?')) {
        stakeholderMapData.nodes = stakeholderMapData.nodes.filter(n => n.id !== nodeId);
        stakeholderMapData.links = stakeholderMapData.links.filter(l => l.source !== nodeId && l.target !== nodeId);
        renderStakeholderMap();
    }
};

const assignRole = (nodeId, role) => {
    const node = stakeholderMapData.nodes.find(n => n.id === nodeId);
    if (node) {
        // If the same role is clicked again, remove it. Otherwise, assign it.
        node.role = node.role === role ? null : role;
    }
    renderStakeholderMap();
};

const showRoleDropdown = (nodeId, event) => {
    event.stopPropagation();
    // Remove any existing dropdowns first
    const existingDropdown = document.getElementById('role-dropdown');
    if (existingDropdown) existingDropdown.remove();

    const roles = ['Champion', 'Economic Buyer', 'Legal', 'IT', 'IS', 'Procurement', 'End User'];
    const dropdown = document.createElement('div');
    dropdown.id = 'role-dropdown';
    dropdown.className = 'role-dropdown';

    roles.forEach(role => {
        const item = document.createElement('div');
        item.className = 'role-dropdown-item';
        item.textContent = role;
        item.onclick = (e) => {
            e.stopPropagation();
            assignRole(nodeId, role);
            dropdown.remove();
        };
        dropdown.appendChild(item);
    });
    
    // Add an option to clear the role
    const clearItem = document.createElement('div');
    clearItem.className = 'role-dropdown-item';
    clearItem.textContent = 'Clear Role';
    clearItem.style.borderTop = '1px solid var(--border-color)';
    clearItem.onclick = (e) => {
        e.stopPropagation();
        assignRole(nodeId, null); // Pass null to clear the role
        dropdown.remove();
    }
    dropdown.appendChild(clearItem);

    document.body.appendChild(dropdown);
    dropdown.style.left = `${event.pageX}px`;
    dropdown.style.top = `${event.pageY}px`;
};

const deselectAllNodes = () => {
    document.querySelectorAll('.stakeholder-node.selected').forEach(selectedNode => {
        selectedNode.classList.remove('selected');
    });
    const existingDropdown = document.getElementById('role-dropdown');
    if (existingDropdown) existingDropdown.remove();
};

const handleNodeClick = (nodeEl, nodeId) => {
    if (isSelectingManager) {
        if (sourceNodeForLink === nodeId) {
            alert("A stakeholder cannot report to themselves.");
            isSelectingManager = false;
            stakeholderCanvas.style.cursor = 'default';
            return;
        }
        stakeholderMapData.links.push({ source: sourceNodeForLink, target: nodeId });
        isSelectingManager = false;
        sourceNodeForLink = null;
        stakeholderCanvas.style.cursor = 'default';
        renderStakeholderMap();
    } else {
        const isAlreadySelected = nodeEl.classList.contains('selected');
        deselectAllNodes();
        if (!isAlreadySelected) {
            nodeEl.classList.add('selected');
        }
    }
};

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
            <span class="influence-control" data-action="influence" data-value="-1">&#9660;</span>
            <span class="influence-control" data-action="influence" data-value="1">&#9650;</span>
            <span class="add-manager-btn" data-action="reports-to">Reports To</span>
            <span class="add-role-btn" data-action="add-role">&#9733; Role</span>
        </div>
    `;
    
    // Add the role badge if it exists
    if (nodeData.role) {
        const badge = document.createElement('div');
        badge.className = 'role-badge';
        badge.textContent = nodeData.role;
        nodeEl.appendChild(badge);
    }

    nodeEl.addEventListener('click', (e) => {
        e.stopPropagation();
        handleNodeClick(nodeEl, nodeData.id);
    });

    nodeEl.addEventListener('mousedown', (e) => {
        const action = e.target.dataset.action;
        if (action) {
            e.stopPropagation();
            if (action === 'support') updateSupport(nodeData.id, e.target.dataset.value);
            else if (action === 'influence') updateInfluence(nodeData.id, parseInt(e.target.dataset.value, 10));
            else if (action === 'remove') removeNode(nodeData.id);
            else if (action === 'reports-to') initiateReportsTo(nodeData.id);
            else if (action === 'add-role') showRoleDropdown(nodeData.id, e);
        } else {
            onDragStart(e);
        }
    });

    stakeholderCanvas.appendChild(nodeEl);
};

const renderStakeholderMap = () => {
    const selectedId = document.querySelector('.stakeholder-node.selected')?.id.replace('node-','');
    stakeholderCanvas.innerHTML = '';
    stakeholderMapData.nodes.forEach(nodeData => createNodeElement(nodeData));
    if(selectedId) {
        document.getElementById(`node-${selectedId}`)?.classList.add('selected');
    }
    drawLines();
};

const drawLines = () => {
    const defs = lineCanvas.querySelector('defs')?.outerHTML;
    lineCanvas.innerHTML = defs || '';
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

const onDragStart = (e) => {
    e.preventDefault();
    deselectAllNodes(); // Deselect nodes when starting a drag
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
    const nodeData = stakeholderMapData.nodes.find(n => n.id === nodeId);
    if (nodeData) {
        nodeData.x = parseInt(activeNode.style.left, 10);
        nodeData.y = parseInt(activeNode.style.top, 10);
    }
    activeNode = null;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', onDragEnd);
};

// --- Stakeholder Map Event Listeners ---
stakeholderMapBtn.addEventListener('click', () => {
    stakeholderMapModal.style.display = 'block';
    renderStakeholderMap();
});

stakeholderMapCloseBtn.addEventListener('click', () => {
    stakeholderMapModal.style.display = 'none';
});

stakeholderCanvas.addEventListener('click', () => {
    deselectAllNodes();
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
        y: 50,
        role: null // Initialize role as null
    };
    stakeholderMapData.nodes.push(newNode);
    nameInput.value = '';
    titleInput.value = '';
    renderStakeholderMap();
});
    
    // --- CORE FUNCTIONS (Unchanged from here) ---
    const updateProgress = () => {
        const visibleFields = allProgressFields.filter(field => field.offsetParent !== null);
        const totalCount = visibleFields.length;
        let completedCount = 0;
        visibleFields.forEach(field => {
            if (field.type === 'checkbox') {
                if (field.checked) completedCount++;
            } else {
                if (field.value && field.value.trim() !== '') completedCount++;
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
        noBudgetQuestionWrapper.style.display = hasBudgetCheckbox.checked ? 'none' : 'block';
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
            if (cb.offsetParent !== null) data[cb.name] = cb.checked;
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
            if (key === 'stakeholderMapData') continue;
            if (key === 'path-to-close[]') {
                if (data[key] && typeof data[key] === 'string') {
                    data[key].split('\n').forEach(step => {
                        if (step.trim() !== '') {
                            const div = document.createElement('div');
                            div.className = 'path-item';
                            div.innerHTML = `<input type="text" name="path-to-close[]" value="${step}">`;
                            pathToCloseContainer.appendChild(div);
                        }
                    });
                }
            } else {
                const element = form.elements[key];
                if (element) {
                    if (element.type === 'checkbox') {
                        element.checked = data[key] === true || data[key] === 'Yes';
                    } else {
                        element.value = data[key] || '';
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

    // --- EVENT LISTENERS (Unchanged from here) ---
    form.addEventListener('input', (event) => {
        if (event.target === hasBudgetCheckbox) handleBudgetCheckboxChange();
        else updateProgress();
    });

    addPathStepBtn.addEventListener('click', () => {
        const div = document.createElement('div');
        div.innerHTML = `<input type="text" name="path-to-close[]" placeholder="Enter another step...">`;
        pathToCloseContainer.appendChild(div);
        updateProgress();
    });
    
    modalCloseBtn.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (event) => {
        if (event.target === modal) modal.style.display = 'none';
        if (event.target === loadDealModal) loadDealModal.style.display = 'none';
        if (event.target === quickViewModal) quickViewModal.style.display = 'none';
        if (event.target === stakeholderMapModal) stakeholderMapModal.style.display = 'none';
    });

    saveBtn.addEventListener('click', async () => {
        const dealData = getFormData();
        const opportunityName = dealData.opportunityName;
        if (!opportunityName) {
            alert('Please enter an Opportunity Name before saving.');
            return;
        }
        if (dealData.arr === '') delete dealData.arr; else dealData.arr = parseInt(dealData.arr, 10);
        if (dealData.screens === '') delete dealData.screens; else dealData.screens = parseInt(dealData.screens, 10);
        if (dealData['path-to-close[]']) {
            dealData['path-to-close[]'] = dealData['path-to-close[]'].filter(step => step.trim() !== '').join('\n');
        }
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;
        try {
            const searchUrl = `${AIRTABLE_API_URL}?filterByFormula={opportunityName}="${opportunityName}"`;
            const searchRes = await fetch(searchUrl, { headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` } });
            if (!searchRes.ok) throw new Error(JSON.stringify(await searchRes.json()));
            const searchData = await searchRes.json();
            const method = (searchData.records && searchData.records.length > 0) ? 'PATCH' : 'POST';
            const recordsPayload = {
                records: [{
                    id: method === 'PATCH' ? searchData.records[0].id : undefined,
                    fields: dealData
                }]
            };
            const response = await fetch(AIRTABLE_API_URL, {
                method: method,
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(recordsPayload)
            });
            if (!response.ok) throw new Error(JSON.stringify(await response.json()));
            alert(`Deal "${opportunityName}" saved successfully!`);
        } catch (error) {
            console.error('Save Error:', error);
            alert(`Failed to save deal. Error: ${error.message}`);
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
    
    quickViewBtn.addEventListener('click', () => { /* ... code unchanged ... */ });
    quickViewModalCloseBtn.addEventListener('click', () => quickViewModal.style.display = 'none');
    showGapsBtn.addEventListener('click', () => { /* ... code unchanged ... */ });
    analyzeBtn.addEventListener('click', async () => { /* ... code unchanged ... */ });

    // --- Stakeholder Map Event Listeners ---
    stakeholderMapBtn.addEventListener('click', () => {
        stakeholderMapModal.style.display = 'block';
        renderStakeholderMap();
    });
    stakeholderMapCloseBtn.addEventListener('click', () => stakeholderMapModal.style.display = 'none');
    stakeholderCanvas.addEventListener('click', () => deselectAllNodes());
    addStakeholderBtn.addEventListener('click', () => {
        const nameInput = document.getElementById('new-stakeholder-name');
        const titleInput = document.getElementById('new-stakeholder-title');
        if (nameInput.value.trim() === '') return alert('Please enter a name.');
        const newNode = {
            id: Date.now().toString(),
            name: nameInput.value.trim(),
            title: titleInput.value.trim(),
            support: 'neutral',
            influence: 1,
            x: 50, y: 50
        };
        stakeholderMapData.nodes.push(newNode);
        nameInput.value = '';
        titleInput.value = '';
        renderStakeholderMap();
    });

    // --- Load Deal Modal Listeners ---
    loadSelectedDealBtn.addEventListener('click', async () => {
        const recordId = loadDealSelect.value;
        if (!recordId) return alert('Please select a deal from the list.');
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
    loadModalCloseBtn.addEventListener('click', () => loadDealModal.style.display = 'none');

    // --- INITIALIZATION ---
    handleBudgetCheckboxChange();
});
