/**
 * ============================================================================
 * Smart Study Planner - Application Logic
 * Pure Vanilla JavaScript (No frameworks, No libraries, No backend, No storage)
 * 
 * Demonstrates React-Equivalent Core Concepts in Vanilla JS:
 * 1. Functional Components: Functions returning HTML strings / DOM elements
 * 2. Props: Passing data and configurations as parameters to functions
 * 3. State: Central application state object with updater functions
 * 4. Conditional Rendering: Rendering different UI states based on data
 * 5. Forms: Controlled input handling, validation, and submission
 * 6. Reusable UI Components: Stat cards, goal cards, subject cards
 * ============================================================================
 */

/* ==========================================================================
   1. Application State (useState Equivalent)
   --------------------------------------------------------------------------
   In React, we use useState() to manage local reactive data.
   Here, we maintain an in-memory state object. Whenever this state changes,
   we invoke our main render function to update the DOM.
   ========================================================================== */

let state = {
    // Array of study goal objects
    // Each goal shape: { id, title, subject, priority, targetDate, completed }
    goals: [],

    // Active filter: 'all' | 'pending' | 'completed'
    currentFilter: 'all'
};

/* ==========================================================================
   2. Reusable UI Components (Functional Components & Props)
   --------------------------------------------------------------------------
   Just like React components (e.g., function StatCard(props) { ... }),
   these pure JavaScript functions receive 'props' as arguments and return
   clean, semantic HTML markup.
   ========================================================================== */

/**
 * Component: StatCard
 * Generates an individual statistical overview card.
 * 
 * @param {Object} props - Component properties
 * @param {string} props.title - Card title (e.g., "Total Goals")
 * @param {string|number} props.value - Numeric or percentage display
 * @param {string} props.type - Category class ('total', 'completed', 'pending', 'progress')
 * @param {string} props.iconSvg - Inline SVG markup for the card icon
 * @param {number} [props.progressPercent] - Optional progress value for the bar
 * @returns {string} HTML string representing the StatCard component
 */
function createStatCard({ title, value, type, iconSvg, progressPercent }) {
    // Conditional rendering for the progress bar inside the Overall Progress card
    const progressBarHtml = (type === 'progress')
        ? `<div class="stat-progress-bar-bg" role="progressbar" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100">
               <div class="stat-progress-bar-fill" style="width: ${value}%"></div>
           </div>`
        : '';

    return `
        <article class="stat-card stat-${type}">
            <div class="stat-card-top">
                <div class="stat-icon-wrapper">
                    ${iconSvg}
                </div>
                <span class="stat-tag ${type}">${type}</span>
            </div>
            <div class="stat-main">
                <span class="stat-value">${value}${type === 'progress' ? '%' : ''}</span>
                <span class="stat-title">${title}</span>
            </div>
            ${progressBarHtml}
        </article>
    `;
}

/**
 * Component: GoalCard
 * Generates a study goal card with title, subject, priority, date, and actions.
 * 
 * @param {Object} goal - Goal data object passed as props
 * @param {string} goal.id - Unique goal identifier
 * @param {string} goal.title - Title / description of the goal
 * @param {string} goal.subject - Academic subject
 * @param {string} goal.priority - 'High' | 'Medium' | 'Low'
 * @param {string} goal.targetDate - Due date string (YYYY-MM-DD)
 * @param {boolean} goal.completed - Completion status
 * @returns {string} HTML string representing the GoalCard component
 */
function createGoalCard(goal) {
    // Format the date for friendly display (e.g., "Oct 15, 2026")
    const formattedDate = formatDisplayDate(goal.targetDate);

    // Conditional styling based on priority
    const priorityClass = `badge-priority-${goal.priority.toLowerCase()}`;

    // Conditional status text and badge class
    const statusText = goal.completed ? 'Completed' : 'Pending';
    const statusBadgeClass = goal.completed ? 'badge-status-completed' : 'badge-status-pending';

    // Conditional button label and icon based on completion state
    const completeButtonText = goal.completed ? 'Mark Pending' : 'Complete';
    const completeButtonIcon = goal.completed
        ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`
        : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

    // Status checkmark icon
    const checkmarkIcon = goal.completed
        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
        : '';

    return `
        <article class="goal-card ${goal.completed ? 'completed' : ''}" data-goal-id="${goal.id}">
            <div class="goal-card-header">
                <div class="goal-title-wrap">
                    <div class="goal-status-icon" title="${statusText}">
                        ${checkmarkIcon}
                    </div>
                    <div>
                        <h3 class="goal-title">${escapeHtml(goal.title)}</h3>
                    </div>
                </div>
                <div class="goal-badges">
                    <span class="badge badge-subject">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                        ${escapeHtml(goal.subject)}
                    </span>
                    <span class="badge ${priorityClass}">
                        ${goal.priority}
                    </span>
                    <span class="badge ${statusBadgeClass}">
                        ${statusText}
                    </span>
                </div>
            </div>

            <div class="goal-card-footer">
                <span class="goal-date" title="Target Deadline">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    Due: ${formattedDate}
                </span>

                <div class="goal-actions">
                    <button 
                        type="button" 
                        class="btn-action btn-complete" 
                        data-action="toggle-complete" 
                        data-id="${goal.id}"
                        title="${goal.completed ? 'Reopen this study goal' : 'Mark this goal as completed'}"
                    >
                        ${completeButtonIcon}
                        <span>${completeButtonText}</span>
                    </button>
                    <button 
                        type="button" 
                        class="btn-action btn-delete" 
                        data-action="delete" 
                        data-id="${goal.id}"
                        title="Delete this study goal"
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                        <span>Delete</span>
                    </button>
                </div>
            </div>
        </article>
    `;
}

/**
 * Component: SubjectCard
 * Generates a subject breakdown card displaying subject name, total goals, and completed goals.
 * 
 * @param {Object} subject - Subject statistics passed as props
 * @param {string} subject.name - Subject name
 * @param {number} subject.totalGoals - Total goals under this subject
 * @param {number} subject.completedGoals - Completed goals count
 * @returns {string} HTML string representing the SubjectCard component
 */
function createSubjectCard(subject) {
    const percent = subject.totalGoals > 0 
        ? Math.round((subject.completedGoals / subject.totalGoals) * 100) 
        : 0;

    return `
        <div class="subject-card">
            <div class="subject-card-top">
                <div class="subject-name-group">
                    <span class="subject-bullet"></span>
                    <span class="subject-name">${escapeHtml(subject.name)}</span>
                </div>
                <span class="subject-counter">${subject.completedGoals}/${subject.totalGoals} done</span>
            </div>
            <div class="subject-stats-row">
                <span class="subject-completed-text">${percent}% completed</span>
                <span>${subject.totalGoals - subject.completedGoals} pending</span>
            </div>
            <div class="subject-progress-bg">
                <div class="subject-progress-fill" style="width: ${percent}%;"></div>
            </div>
        </div>
    `;
}

/* ==========================================================================
   3. Render Functions (Section Renderers)
   --------------------------------------------------------------------------
   These functions calculate derived data and inject component HTML into the DOM.
   ========================================================================== */

/**
 * Render Statistics Section
 * Calculates: Total Goals, Completed Goals, Pending Goals, Overall Progress.
 * Reusable createStatCard() is called for each card.
 */
function renderStats() {
    const container = document.getElementById('stats-container');
    if (!container) return;

    // Derived values from state
    const totalGoals = state.goals.length;
    const completedGoals = state.goals.filter(goal => goal.completed).length;
    const pendingGoals = totalGoals - completedGoals;
    const overallProgress = totalGoals === 0 ? 0 : Math.round((completedGoals / totalGoals) * 100);

    // SVGs for the 4 stat cards
    const icons = {
        total: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
        completed: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
        pending: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
        progress: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 12l-4-4-4 4M12 16V8"/></svg>`
    };

    // Render the 4 cards using the reusable createStatCard component
    const cardsHtml = [
        createStatCard({ title: 'Total Goals', value: totalGoals, type: 'total', iconSvg: icons.total }),
        createStatCard({ title: 'Completed Goals', value: completedGoals, type: 'completed', iconSvg: icons.completed }),
        createStatCard({ title: 'Pending Goals', value: pendingGoals, type: 'pending', iconSvg: icons.pending }),
        createStatCard({ title: 'Overall Progress', value: overallProgress, type: 'progress', iconSvg: icons.progress })
    ].join('');

    container.innerHTML = cardsHtml;
}

/**
 * Render Study Goals Section
 * Demonstrates Conditional Rendering:
 * - If state.goals is empty: displays "No study goals yet. Create your first goal!"
 * - If goals exist: renders filtered list of goal cards.
 */
function renderGoals() {
    const container = document.getElementById('goals-list');
    if (!container) return;

    // Conditional Rendering: Empty State
    if (state.goals.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                </div>
                <h3 class="empty-state-title">No study goals yet. Create your first goal!</h3>
                <p class="empty-state-desc">
                    Boost your academic productivity by scheduling study goals with subjects, priorities, and deadlines.
                </p>
                <a href="#goal-title" class="btn-empty-action" onclick="document.getElementById('goal-title').focus();">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    <span>Create Goal Now</span>
                </a>
            </div>
        `;
        return;
    }

    // Apply Filter (All, Pending, Completed)
    let filteredGoals = state.goals;
    if (state.currentFilter === 'pending') {
        filteredGoals = state.goals.filter(goal => !goal.completed);
    } else if (state.currentFilter === 'completed') {
        filteredGoals = state.goals.filter(goal => goal.completed);
    }

    // Secondary Conditional Rendering: Filter produced empty list
    if (filteredGoals.length === 0) {
        const filterName = state.currentFilter === 'pending' ? 'pending' : 'completed';
        container.innerHTML = `
            <div class="empty-state">
                <h3 class="empty-state-title">No ${filterName} study goals found</h3>
                <p class="empty-state-desc">Switch filter to "All Goals" to view all created milestones.</p>
            </div>
        `;
        return;
    }

    // Map each goal to its HTML card using createGoalCard component
    const goalsHtml = filteredGoals.map(goal => createGoalCard(goal)).join('');
    container.innerHTML = goalsHtml;
}

/**
 * Render Subjects Section
 * Groups goals by subject and computes:
 * - Subject Name
 * - Number of goals
 * - Number of completed goals
 * 
 * Automatically updates whenever goals are added, completed, or deleted.
 */
function renderSubjects() {
    const container = document.getElementById('subjects-list');
    if (!container) return;

    // If no goals exist yet, display friendly message
    if (state.goals.length === 0) {
        container.innerHTML = `
            <div class="subjects-empty">
                <p>No subjects yet.</p>
                <p style="margin-top: 0.25rem; font-size: 0.8rem;">Subjects appear here automatically when you add goals.</p>
            </div>
        `;
        return;
    }

    // Aggregate subjects from goals state
    // Maps subjectName -> { name, totalGoals, completedGoals }
    const subjectMap = {};

    state.goals.forEach(goal => {
        const normalized = goal.subject.trim();
        if (!subjectMap[normalized]) {
            subjectMap[normalized] = {
                name: normalized,
                totalGoals: 0,
                completedGoals: 0
            };
        }
        subjectMap[normalized].totalGoals += 1;
        if (goal.completed) {
            subjectMap[normalized].completedGoals += 1;
        }
    });

    const subjectsArray = Object.values(subjectMap);

    // Sort subjects alphabetically for a clean display
    subjectsArray.sort((a, b) => a.name.localeCompare(b.name));

    // Render using reusable createSubjectCard component
    const subjectsHtml = subjectsArray.map(subj => createSubjectCard(subj)).join('');
    container.innerHTML = subjectsHtml;
}

/**
 * Master Render Function
 * Coordinates rendering of all dashboard sections, reflecting the current state.
 */
function renderApp() {
    renderStats();
    renderGoals();
    renderSubjects();
}

/* ==========================================================================
   4. State Mutation & Event Handlers (Actions)
   --------------------------------------------------------------------------
   Pure functions to manipulate state and trigger renderApp().
   ========================================================================== */

/**
 * Add a new goal to the state
 * 
 * @param {Object} goalData - { title, subject, priority, targetDate }
 */
function addGoal(goalData) {
    const newGoal = {
        id: 'goal_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        title: goalData.title.trim(),
        subject: goalData.subject.trim(),
        priority: goalData.priority,
        targetDate: goalData.targetDate,
        completed: false,
        createdAt: new Date().toISOString()
    };

    // Push into state array
    state.goals.unshift(newGoal); // Add to beginning of array so newest shows first

    // Trigger full UI update
    renderApp();
}

/**
 * Toggle the completion status of a goal
 * 
 * @param {string} goalId - ID of the goal to toggle
 */
function toggleGoalCompletion(goalId) {
    const goal = state.goals.find(g => g.id === goalId);
    if (goal) {
        // Toggle completed boolean
        goal.completed = !goal.completed;
        // Update statistics and UI
        renderApp();
    }
}

/**
 * Delete a goal from the state
 * 
 * @param {string} goalId - ID of the goal to remove
 */
function deleteGoal(goalId) {
    // Filter out the goal
    state.goals = state.goals.filter(g => g.id !== goalId);
    // Update statistics and UI
    renderApp();
}

/* ==========================================================================
   5. Form Handling & Validation
   --------------------------------------------------------------------------
   Validates inputs, extracts values, updates state, and resets the form.
   ========================================================================== */

/**
 * Initialize Goal Form Submission & Validation
 */
function initGoalForm() {
    const form = document.getElementById('goal-form');
    const alertBox = document.getElementById('form-alert');
    const titleInput = document.getElementById('goal-title');
    const subjectInput = document.getElementById('goal-subject');
    const prioritySelect = document.getElementById('goal-priority');
    const dateInput = document.getElementById('goal-date');

    // Set minimum date for target date input to today
    const todayStr = new Date().toISOString().split('T')[0];
    if (dateInput) {
        dateInput.min = todayStr;
        // Default target date to today or tomorrow
        dateInput.value = todayStr;
    }

    if (!form) return;

    form.addEventListener('submit', function (event) {
        event.preventDefault(); // Prevent standard browser page reload

        // Reset previous validation error styling
        [titleInput, subjectInput, prioritySelect, dateInput].forEach(el => {
            if (el) el.classList.remove('error');
        });
        alertBox.style.display = 'none';
        alertBox.textContent = '';

        // Form field values
        const title = titleInput.value.trim();
        const subject = subjectInput.value.trim();
        const priority = prioritySelect.value;
        const targetDate = dateInput.value;

        // Validation: All fields are required
        const missingFields = [];
        if (!title) {
            missingFields.push('Goal Title');
            titleInput.classList.add('error');
        }
        if (!subject) {
            missingFields.push('Subject');
            subjectInput.classList.add('error');
        }
        if (!priority) {
            missingFields.push('Priority');
            prioritySelect.classList.add('error');
        }
        if (!targetDate) {
            missingFields.push('Target Date');
            dateInput.classList.add('error');
        }

        // Show error alert if validation fails
        if (missingFields.length > 0) {
            alertBox.textContent = `Please fill out all required fields: ${missingFields.join(', ')}.`;
            alertBox.style.display = 'flex';
            return;
        }

        // Add goal to state
        addGoal({
            title: title,
            subject: subject,
            priority: priority,
            targetDate: targetDate
        });

        // Reset the form
        form.reset();
        if (dateInput) {
            dateInput.value = todayStr;
        }

        // Focus title input for rapid entry of next goal
        titleInput.focus();
    });
}

/* ==========================================================================
   6. Event Listeners & Event Delegation
   --------------------------------------------------------------------------
   Using clean event delegation on containers ensures complete and delete
   buttons work reliably as new goals are rendered dynamically.
   ========================================================================== */

/**
 * Setup Goals List Event Delegation for Complete and Delete buttons
 */
function initGoalActions() {
    const goalsContainer = document.getElementById('goals-list');
    if (!goalsContainer) return;

    goalsContainer.addEventListener('click', function (event) {
        // Find closest button with data-action
        const button = event.target.closest('[data-action]');
        if (!button) return;

        const action = button.getAttribute('data-action');
        const goalId = button.getAttribute('data-id');

        if (action === 'toggle-complete') {
            toggleGoalCompletion(goalId);
        } else if (action === 'delete') {
            deleteGoal(goalId);
        }
    });
}

/**
 * Setup Filter Controls (All, Pending, Completed)
 */
function initFilterControls() {
    const filterButtons = document.querySelectorAll('.filter-pill');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            filterButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            state.currentFilter = this.getAttribute('data-filter');
            renderGoals(); // Re-render goals section based on filter
        });
    });
}

/**
 * Setup Demo Goals Loader
 * Enables rapid demonstration of dashboard features with one click.
 */
function initDemoLoader() {
    const demoBtn = document.getElementById('btn-load-demo');
    if (!demoBtn) return;

    demoBtn.addEventListener('click', function () {
        // Today's and upcoming dates
        const now = new Date();
        const formatDateOffset = (days) => {
            const d = new Date(now);
            d.setDate(d.getDate() + days);
            return d.toISOString().split('T')[0];
        };

        const sampleGoals = [
            {
                id: 'demo_1',
                title: 'Review Calculus derivatives & integration techniques',
                subject: 'Mathematics',
                priority: 'High',
                targetDate: formatDateOffset(1),
                completed: true,
                createdAt: now.toISOString()
            },
            {
                id: 'demo_2',
                title: 'Solve kinematics & Newton laws practice problems',
                subject: 'Physics',
                priority: 'High',
                targetDate: formatDateOffset(2),
                completed: false,
                createdAt: now.toISOString()
            },
            {
                id: 'demo_3',
                title: 'Implement Binary Search Trees & Graph traversal algorithms',
                subject: 'Computer Science',
                priority: 'Medium',
                targetDate: formatDateOffset(4),
                completed: true,
                createdAt: now.toISOString()
            },
            {
                id: 'demo_4',
                title: 'Organic Chemistry: reaction mechanisms & syntheses review',
                subject: 'Chemistry',
                priority: 'Low',
                targetDate: formatDateOffset(5),
                completed: false,
                createdAt: now.toISOString()
            },
            {
                id: 'demo_5',
                title: 'Prepare presentation on World War II diplomatic history',
                subject: 'History',
                priority: 'Medium',
                targetDate: formatDateOffset(7),
                completed: false,
                createdAt: now.toISOString()
            }
        ];

        // Replace state goals with sample goals
        state.goals = sampleGoals;
        renderApp();
    });
}

/**
 * Setup Current Date Display in Header
 */
function initHeaderDate() {
    const dateEl = document.getElementById('header-date');
    if (!dateEl) return;

    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    const today = new Date();
    dateEl.textContent = today.toLocaleDateString('en-US', options);
}

/* ==========================================================================
   7. Helper Utilities
   ========================================================================== */

/**
 * Format YYYY-MM-DD string to user-friendly "MMM DD, YYYY"
 * 
 * @param {string} dateString 
 * @returns {string} Formatted date
 */
function formatDisplayDate(dateString) {
    if (!dateString) return 'No Date';
    try {
        const parts = dateString.split('-');
        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            const date = new Date(year, month, day);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
        return dateString;
    } catch (e) {
        return dateString;
    }
}

/**
 * Escape HTML special characters to prevent any XSS issues
 * 
 * @param {string} str 
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/* ==========================================================================
   8. Application Initialization
   --------------------------------------------------------------------------
   Fires when DOM is fully loaded.
   ========================================================================== */
document.addEventListener('DOMContentLoaded', function () {
    // 1. Initialize Header Date
    initHeaderDate();

    // 2. Initialize Form Handling
    initGoalForm();

    // 3. Initialize Goal List Action Delegation (Complete / Delete)
    initGoalActions();

    // 4. Initialize Filter Controls
    initFilterControls();

    // 5. Initialize Demo Loader
    initDemoLoader();

    // 6. Initial Render of Application (Stats, Goals [empty state], Subjects)
    renderApp();
});
