/**
 * ============================================================================
 * Smart Study Planner - React Application Logic
 * Built with React 18 & Babel Standalone (CDN)
 * 
 * Hackathon-Friendly React Architecture:
 * 1. Functional Components: Modular, reusable UI building blocks
 * 2. Props: Explicit data flow and callbacks passed down to components
 * 3. State (useState): Central reactive application state
 * 4. Effects (useEffect): LocalStorage persistence & local date synchronization
 * 5. Conditional Rendering: Empty states, completion indicators, & urgent badges
 * ============================================================================
 */

// Destructure standard React hooks from global React object
const { useState, useEffect, useMemo, useRef } = React;

/* ==========================================================================
   Helper Utilities
   ========================================================================== */

/**
 * Returns today's date in local calendar format (YYYY-MM-DD).
 * Prevents UTC timezone shift glitches.
 */
function getTodayLocalDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Returns an offset date string (YYYY-MM-DD) relative to today.
 */
function getLocalDateOffset(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string into a local Date object set at 00:00:00 local time.
 * Prevents UTC timezone shift errors.
 */
function parseLocalDate(dateString) {
    if (!dateString || typeof dateString !== 'string') return null;
    const parts = dateString.split('-');
    if (parts.length !== 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    return new Date(year, month, day);
}

/**
 * Calculates the exact difference in local calendar days (targetDate - baseDate).
 *  < 0 : Overdue (e.g. -1 is yesterday, -2 is 2 days ago)
 *  = 0 : Due Today
 *  = 1 : Due Tomorrow
 *  > 1 : Due in X days
 */
function getLocalDayDifference(dateString, todayStr) {
    if (!dateString) return null;
    const baseDateStr = todayStr || getTodayLocalDate();
    const target = parseLocalDate(dateString);
    const base = parseLocalDate(baseDateStr);
    if (!target || !base) return null;
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.round((target.getTime() - base.getTime()) / msPerDay);
}

/**
 * Formats a YYYY-MM-DD string into user-friendly "MMM DD, YYYY" using local calendar time.
 */
function formatDisplayDate(dateString) {
    if (!dateString) return 'No Date';
    try {
        const date = parseLocalDate(dateString);
        if (date) {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
        return dateString;
    } catch (e) {
        return dateString;
    }
}

/**
 * Determines deadline urgency for pending goals.
 * Completed goals strictly return null (never displayed as overdue or due soon).
 * Returns an object with { label, className, diff } or null.
 */
function getDueStatus(dateString, completed, todayStr) {
    if (completed || !dateString) return null;
    const diff = getLocalDayDifference(dateString, todayStr);
    if (diff === null) return null;

    if (diff < 0) {
        const daysAgo = Math.abs(diff);
        const label = daysAgo === 1 ? 'Overdue by 1 day' : `Overdue by ${daysAgo} days`;
        return { label, className: 'badge-overdue', diff };
    }
    if (diff === 0) {
        return { label: 'Due Today', className: 'badge-due-today', diff };
    }
    if (diff === 1) {
        return { label: 'Due Tomorrow', className: 'badge-due-tomorrow', diff };
    }
    return {
        label: `Due in ${diff} days`,
        className: diff <= 3 ? 'badge-due-soon' : 'badge-due-upcoming',
        diff
    };
}

/**
 * Deterministic Recommendation Engine:
 * Selects the single best incomplete study goal to focus on next based on:
 * 1. Overdue milestones (missed deadlines are prioritized highest)
 * 2. Deadline closeness (due today/tomorrow > upcoming)
 * 3. Priority level (High > Medium > Low)
 * 4. Earliest deadline as tie-breaker
 * Note: Completed goals are strictly excluded.
 */
function getUrgencyWindow(targetDate, todayStr) {
    const diff = getLocalDayDifference(targetDate, todayStr);
    if (diff === null) return 4;
    if (diff < 0) return 0; // Overdue
    if (diff === 0) return 1; // Due Today
    if (diff <= 3) return 2; // Due Soon (within 3 days)
    return 3; // Due Later
}

function getRecommendedGoal(goals, todayStr) {
    const pending = goals.filter(g => !g.completed && g.targetDate);
    if (pending.length === 0) return null;

    const priorityRank = { 'High': 3, 'Medium': 2, 'Low': 1 };

    const sorted = [...pending].sort((a, b) => {
        // 1 & 2: Urgency window based on whether overdue and closeness of deadline
        const windowA = getUrgencyWindow(a.targetDate, todayStr);
        const windowB = getUrgencyWindow(b.targetDate, todayStr);

        if (windowA !== windowB) {
            return windowA - windowB;
        }

        // 3. Priority level (High > Medium > Low)
        const pDiff = (priorityRank[b.priority] || 1) - (priorityRank[a.priority] || 1);
        if (pDiff !== 0) {
            return pDiff;
        }

        // 4. If otherwise equal, use earliest deadline
        const dateDiff = a.targetDate.localeCompare(b.targetDate);
        if (dateDiff !== 0) {
            return dateDiff;
        }

        // Deterministic stable tie-breaker: creation timestamp
        return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });

    return sorted[0];
}

/**
 * Returns a concise, user-friendly explanation of why the goal is recommended.
 */
function getRecommendationReason(goal, todayStr) {
    if (!goal) return '';
    const diffDays = getLocalDayDifference(goal.targetDate, todayStr);
    if (diffDays === null) return `Focus milestone with ${goal.priority} Priority`;

    if (diffDays < 0) {
        const daysAgo = Math.abs(diffDays);
        return daysAgo === 1
            ? `Overdue by 1 day · Immediate focus (${goal.priority} Priority)`
            : `Overdue by ${daysAgo} days · Immediate focus (${goal.priority} Priority)`;
    }
    if (diffDays === 0) {
        return `Due today · Urgent milestone (${goal.priority} Priority)`;
    }
    if (diffDays === 1) {
        return `Due tomorrow · Recommended next focus (${goal.priority} Priority)`;
    }
    if (diffDays <= 3) {
        return `Due in ${diffDays} days · Approaching deadline (${goal.priority} Priority)`;
    }
    return `Closest milestone with ${goal.priority} Priority`;
}

/* ==========================================================================
   Component: Sidebar
   ========================================================================== */
function Sidebar({ activeNav, onNavClick }) {
    const navItems = [
        {
            id: 'dashboard',
            label: 'Dashboard',
            href: '#dashboard',
            icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="9"/>
                    <rect x="14" y="3" width="7" height="5"/>
                    <rect x="14" y="12" width="7" height="9"/>
                    <rect x="3" y="16" width="7" height="5"/>
                </svg>
            )
        },
        {
            id: 'create-goal',
            label: 'Create Goal',
            href: '#create-goal-section',
            icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="16"/>
                    <line x1="8" y1="12" x2="16" y2="12"/>
                </svg>
            )
        },
        {
            id: 'goals',
            label: 'Study Goals',
            href: '#goals-section',
            icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
            )
        },
        {
            id: 'subjects',
            label: 'Subjects',
            href: '#subjects-section',
            icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
            )
        }
    ];

    return (
        <aside className="sidebar" id="sidebar">
            <div className="sidebar-brand">
                <div className="brand-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                        <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                    </svg>
                </div>
                <div className="brand-text">
                    <span className="brand-title">StudyPlanner</span>
                    <span className="brand-badge">Student Pro</span>
                </div>
            </div>

            <nav className="sidebar-nav" aria-label="Main Navigation">
                {navItems.map(item => (
                    <a
                        key={item.id}
                        id={`nav-${item.id}`}
                        href={item.href}
                        className={`nav-item ${activeNav === item.id ? 'active' : ''}`}
                        onClick={(e) => {
                            e.preventDefault();
                            onNavClick(item.id, item.href);
                        }}
                    >
                        {item.icon}
                        <span>{item.label}</span>
                    </a>
                ))}
            </nav>

            <div className="sidebar-tip">
                <div className="tip-header">
                    <span className="tip-icon">💡</span>
                    <span className="tip-label">Study Tip</span>
                </div>
                <p className="tip-text">Break big topics into bite-sized tasks. Track each as a separate goal for steady momentum!</p>
            </div>

            <div className="sidebar-user">
                <div className="user-avatar">SG</div>
                <div className="user-info">
                    <div className="user-name">Study Scholar</div>
                    <div className="user-role">Academic Dashboard</div>
                </div>
            </div>
        </aside>
    );
}

/* ==========================================================================
   Component: Header
   ========================================================================== */
function Header({ onLoadDemoGoals }) {
    const formattedDate = useMemo(() => {
        const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
        return new Date().toLocaleDateString('en-US', options);
    }, []);

    return (
        <header className="app-header">
            <div className="header-content">
                <div className="header-titles">
                    <div className="greeting-tag">Student Dashboard</div>
                    <h1 className="main-title">Smart Study Planner</h1>
                    <p className="subtitle">Plan your studies. Track your progress.</p>
                </div>
                <div className="header-actions">
                    <div className="date-badge" id="current-date-badge">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        <span>{formattedDate}</span>
                    </div>
                    <button
                        type="button"
                        className="btn-demo"
                        id="btn-load-demo"
                        onClick={onLoadDemoGoals}
                        title="Add sample study goals to explore the dashboard"
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                        <span>Load Demo Goals</span>
                    </button>
                </div>
            </div>
        </header>
    );
}

/* ==========================================================================
   Component: StatCard
   ========================================================================== */
function StatCard({ title, value, type, icon, isProgress, tagLabel }) {
    const displayTag = tagLabel || (type === 'due-soon' ? 'Due Soon' : type);
    return (
        <article className={`stat-card stat-${type}`}>
            <div className="stat-card-top">
                <div className="stat-icon-wrapper">
                    {icon}
                </div>
                <span className={`stat-tag ${type}`}>{displayTag}</span>
            </div>
            <div className="stat-main">
                <span className="stat-value">{value}{isProgress ? '%' : ''}</span>
                <span className="stat-title">{title}</span>
            </div>
            {isProgress && (
                <div
                    className="stat-progress-bar-bg"
                    role="progressbar"
                    aria-valuenow={value}
                    aria-valuemin="0"
                    aria-valuemax="100"
                >
                    <div className="stat-progress-bar-fill" style={{ width: `${value}%` }}></div>
                </div>
            )}
        </article>
    );
}

/* ==========================================================================
   Component: RecommendedGoal
   ========================================================================== */
function RecommendedGoal({ goal, todayStr, onStartNow, totalGoalsCount, pendingGoalsCount }) {
    if (!goal) {
        if (totalGoalsCount > 0 && pendingGoalsCount === 0) {
            return (
                <section className="recommendation-card rec-all-done" aria-label="Recommended Next Goal">
                    <div className="recommendation-content">
                        <div className="rec-icon-box rec-icon-done">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                <polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                        </div>
                        <div className="rec-details">
                            <div className="rec-tag">Recommended Next Goal</div>
                            <h3 className="rec-title">All Caught Up! Great Job!</h3>
                            <p className="rec-subtitle">
                                You have completed all active study goals. Add new targets to keep your academic momentum going.
                            </p>
                        </div>
                    </div>
                </section>
            );
        }

        return (
            <section className="recommendation-card rec-empty" aria-label="Recommended Next Goal">
                <div className="recommendation-content">
                    <div className="rec-icon-box rec-icon-empty">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                        </svg>
                    </div>
                    <div className="rec-details">
                        <div className="rec-tag">Recommended Next Goal</div>
                        <h3 className="rec-title">Smart Next Goal Recommendation</h3>
                        <p className="rec-subtitle">
                            Create your first study goal below to receive personalized focus recommendations based on priority and deadlines.
                        </p>
                    </div>
                </div>
            </section>
        );
    }

    const reason = getRecommendationReason(goal, todayStr);
    const formattedDate = formatDisplayDate(goal.targetDate);
    const priorityClass = `badge-priority-${goal.priority.toLowerCase()}`;
    const diffDays = getLocalDayDifference(goal.targetDate, todayStr);
    const isOverdue = diffDays !== null && diffDays < 0;
    const isToday = diffDays === 0;

    return (
        <section
            className={`recommendation-card ${isOverdue ? 'rec-overdue' : isToday ? 'rec-today' : ''}`}
            aria-label="Recommended Next Goal"
        >
            <div className="rec-top-row">
                <div className="rec-tag-group">
                    <span className="rec-tag">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                        Recommended Next Goal
                    </span>
                    <span className="rec-reason">{reason}</span>
                </div>
            </div>

            <div className="rec-main-row">
                <div className="rec-goal-info">
                    <h3 className="rec-goal-title">{goal.title}</h3>
                    <div className="rec-meta-badges">
                        <span className="badge badge-subject">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                            </svg>
                            {goal.subject}
                        </span>
                        <span className={`badge ${priorityClass}`}>
                            {goal.priority} Priority
                        </span>
                        <span className="rec-deadline-text">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                <line x1="16" y1="2" x2="16" y2="6"/>
                                <line x1="8" y1="2" x2="8" y2="6"/>
                                <line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                            Due: {formattedDate}
                        </span>
                    </div>
                </div>

                <div className="rec-action-wrap">
                    <button
                        type="button"
                        className="btn-start-now"
                        onClick={() => onStartNow(goal.id)}
                        title="Focus on this study goal"
                    >
                        <span>Start Now</span>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"/>
                            <polyline points="12 5 19 12 12 19"/>
                        </svg>
                    </button>
                </div>
            </div>
        </section>
    );
}

/* ==========================================================================
   Component: FilterTabs
   ========================================================================== */
function FilterTabs({ currentFilter, onFilterChange }) {
    const filters = [
        { key: 'all', label: 'All Goals' },
        { key: 'pending', label: 'Pending' },
        { key: 'completed', label: 'Completed' }
    ];

    return (
        <div className="filter-controls">
            {filters.map(f => (
                <button
                    key={f.key}
                    id={`filter-tab-${f.key}`}
                    data-filter={f.key}
                    type="button"
                    className={`filter-pill ${currentFilter === f.key ? 'active' : ''}`}
                    onClick={() => onFilterChange(f.key)}
                >
                    {f.label}
                </button>
            ))}
        </div>
    );
}

/* ==========================================================================
   Component: GoalCard
   ========================================================================== */
function GoalCard({ goal, todayStr, highlighted, onToggleComplete, onDelete }) {
    const formattedDate = formatDisplayDate(goal.targetDate);
    const dueStatus = getDueStatus(goal.targetDate, goal.completed, todayStr);

    const priorityClass = `badge-priority-${goal.priority.toLowerCase()}`;
    const statusText = goal.completed ? 'Completed' : 'Pending';
    const statusBadgeClass = goal.completed ? 'badge-status-completed' : 'badge-status-pending';

    return (
        <article
            className={`goal-card ${goal.completed ? 'completed' : ''} ${highlighted ? 'goal-card-highlight' : ''}`}
            id={`goal-card-${goal.id}`}
            data-goal-id={goal.id}
        >
            <div className="goal-card-header">
                <div className="goal-title-wrap">
                    <div className="goal-status-icon" title={statusText}>
                        {goal.completed && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                        )}
                    </div>
                    <div>
                        <h3 className="goal-title">{goal.title}</h3>
                    </div>
                </div>
                <div className="goal-badges">
                    <span className="badge badge-subject">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                        </svg>
                        {goal.subject}
                    </span>
                    <span className={`badge ${priorityClass}`}>
                        {goal.priority}
                    </span>
                    <span className={`badge ${statusBadgeClass}`}>
                        {statusText}
                    </span>
                    {dueStatus && (
                        <span className={`badge ${dueStatus.className}`}>
                            {dueStatus.label}
                        </span>
                    )}
                </div>
            </div>

            <div className="goal-card-footer">
                <span className="goal-date" title="Target Deadline">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    Due: {formattedDate}
                </span>

                <div className="goal-actions">
                    <button
                        type="button"
                        className="btn-action btn-complete"
                        onClick={() => onToggleComplete(goal.id)}
                        title={goal.completed ? 'Reopen this study goal' : 'Mark this goal as completed'}
                    >
                        {goal.completed ? (
                            <>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 6L6 18M6 6l12 12"/>
                                </svg>
                                <span>Mark Pending</span>
                            </>
                        ) : (
                            <>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"/>
                                </svg>
                                <span>Complete</span>
                            </>
                        )}
                    </button>
                    <button
                        type="button"
                        className="btn-action btn-delete"
                        onClick={() => onDelete(goal.id)}
                        title="Delete this study goal"
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                        <span>Delete</span>
                    </button>
                </div>
            </div>
        </article>
    );
}

/* ==========================================================================
   Component: GoalList
   ========================================================================== */
function GoalList({ goals, currentFilter, totalCount, onToggleComplete, onDelete, onFocusForm, todayStr, highlightedGoalId }) {
    // 1. Overall Empty State (no goals at all)
    if (totalCount === 0) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                </div>
                <h3 className="empty-state-title">No study goals yet. Create your first goal!</h3>
                <p className="empty-state-desc">
                    Boost your academic productivity by scheduling study goals with subjects, priorities, and deadlines.
                </p>
                <button
                    type="button"
                    className="btn-empty-action"
                    onClick={onFocusForm}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    <span>Create Goal Now</span>
                </button>
            </div>
        );
    }

    // 2. Filter-Produced Empty State
    if (goals.length === 0) {
        return (
            <div className="empty-state">
                <h3 className="empty-state-title">No {currentFilter} study goals found</h3>
                <p className="empty-state-desc">Switch filter to "All Goals" to view all created milestones.</p>
            </div>
        );
    }

    // 3. Render List of Goal Cards
    return (
        <div className="goals-list" id="goals-list">
            {goals.map(goal => (
                <GoalCard
                    key={goal.id}
                    goal={goal}
                    todayStr={todayStr}
                    highlighted={highlightedGoalId === goal.id}
                    onToggleComplete={onToggleComplete}
                    onDelete={onDelete}
                />
            ))}
        </div>
    );
}

/* ==========================================================================
   Component: GoalForm
   ========================================================================== */
function GoalForm({ onAddGoal, availableSubjects, titleInputRef }) {
    const todayStr = getTodayLocalDate();

    // Controlled form state
    const [title, setTitle] = useState('');
    const [subject, setSubject] = useState('');
    const [priority, setPriority] = useState('');
    const [targetDate, setTargetDate] = useState(todayStr);

    // Validation state
    const [alertMessage, setAlertMessage] = useState('');
    const [errors, setErrors] = useState({});

    // Base default academic subjects
    const defaultSubjects = [
        'Biology',
        'Chemistry',
        'Computer Science',
        'History',
        'Literature',
        'Mathematics',
        'Physics'
    ];

    // Dynamically build suggestions combining default subjects & existing student goals
    // Eliminates duplicates (case-insensitively) and keeps suggestions alphabetically sorted
    const mergedSubjects = useMemo(() => {
        const subjectMap = new Map();

        // 1. Add default common subjects
        defaultSubjects.forEach(s => {
            const trimmed = (s || '').trim();
            if (trimmed) {
                const key = trimmed.toLowerCase();
                if (!subjectMap.has(key)) {
                    subjectMap.set(key, trimmed);
                }
            }
        });

        // 2. Add subjects dynamically from the student's current goals
        (availableSubjects || []).forEach(s => {
            const trimmed = (s || '').trim();
            if (trimmed) {
                const key = trimmed.toLowerCase();
                if (!subjectMap.has(key)) {
                    subjectMap.set(key, trimmed);
                }
            }
        });

        // 3. Convert to unique array and sort alphabetically
        const list = Array.from(subjectMap.values());
        list.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        return list;
    }, [availableSubjects]);

    const handleSubmit = (e) => {
        e.preventDefault();

        const trimmedTitle = title.trim();
        const trimmedSubject = subject.trim();

        // Validation check
        const newErrors = {};
        const missing = [];

        if (!trimmedTitle) {
            newErrors.title = true;
            missing.push('Goal Title');
        }
        if (!trimmedSubject) {
            newErrors.subject = true;
            missing.push('Subject');
        }
        if (!priority) {
            newErrors.priority = true;
            missing.push('Priority');
        }
        if (!targetDate) {
            newErrors.targetDate = true;
            missing.push('Target Date');
        }

        if (missing.length > 0) {
            setErrors(newErrors);
            setAlertMessage(`Please fill out all required fields: ${missing.join(', ')}.`);
            return;
        }

        // Clear errors
        setErrors({});
        setAlertMessage('');

        // Trigger parent state update
        onAddGoal({
            title: trimmedTitle,
            subject: trimmedSubject,
            priority: priority,
            targetDate: targetDate
        });

        // Reset form inputs
        setTitle('');
        setSubject('');
        setPriority('');
        setTargetDate(todayStr);

        // Keep focus on title for rapid entry
        if (titleInputRef && titleInputRef.current) {
            titleInputRef.current.focus();
        }
    };

    return (
        <section className="create-goal-section" id="create-goal-section" aria-label="Create New Study Goal">
            <div className="card-box create-goal-card">
                <div className="card-box-header">
                    <div className="header-icon-box">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="16"/>
                            <line x1="8" y1="12" x2="16" y2="12"/>
                        </svg>
                    </div>
                    <div>
                        <h2 className="card-title">Create Study Goal</h2>
                        <p className="card-subtitle">Define a new target with subject & priority</p>
                    </div>
                </div>

                {alertMessage && (
                    <div className="form-alert" role="alert">
                        {alertMessage}
                    </div>
                )}

                <form className="goal-form" onSubmit={handleSubmit} noValidate>
                    {/* Goal Title */}
                    <div className="form-group">
                        <label htmlFor="goal-title" className="form-label">
                            Goal Title <span className="required-star">*</span>
                        </label>
                        <input
                            ref={titleInputRef}
                            type="text"
                            id="goal-title"
                            name="goalTitle"
                            className={`form-control ${errors.title ? 'error' : ''}`}
                            placeholder="e.g., Revise Calculus Chapter 4"
                            value={title}
                            onChange={(e) => {
                                setTitle(e.target.value);
                                if (errors.title) setErrors(prev => ({ ...prev, title: false }));
                            }}
                            required
                        />
                    </div>

                    {/* Subject Input with Datalist Suggestions */}
                    <div className="form-group">
                        <label htmlFor="goal-subject" className="form-label">
                            Subject <span className="required-star">*</span>
                        </label>
                        <input
                            type="text"
                            id="goal-subject"
                            name="goalSubject"
                            className={`form-control ${errors.subject ? 'error' : ''}`}
                            placeholder="e.g., Mathematics, Physics..."
                            list="subject-suggestions"
                            value={subject}
                            onChange={(e) => {
                                setSubject(e.target.value);
                                if (errors.subject) setErrors(prev => ({ ...prev, subject: false }));
                            }}
                            required
                        />
                        <datalist id="subject-suggestions">
                            {mergedSubjects.map(subj => (
                                <option key={subj} value={subj} />
                            ))}
                        </datalist>
                    </div>

                    {/* Priority and Target Date in two columns */}
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="goal-priority" className="form-label">
                                Priority <span className="required-star">*</span>
                            </label>
                            <select
                                id="goal-priority"
                                name="goalPriority"
                                className={`form-control ${errors.priority ? 'error' : ''}`}
                                value={priority}
                                onChange={(e) => {
                                    setPriority(e.target.value);
                                    if (errors.priority) setErrors(prev => ({ ...prev, priority: false }));
                                }}
                                required
                            >
                                <option value="" disabled>Select priority</option>
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="goal-date" className="form-label">
                                Target Date <span className="required-star">*</span>
                            </label>
                            <input
                                type="date"
                                id="goal-date"
                                name="goalDate"
                                className={`form-control ${errors.targetDate ? 'error' : ''}`}
                                value={targetDate}
                                onChange={(e) => {
                                    setTargetDate(e.target.value);
                                    if (errors.targetDate) setErrors(prev => ({ ...prev, targetDate: false }));
                                }}
                                required
                            />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button type="submit" className="btn-primary" id="btn-submit-goal">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        <span>Add Goal</span>
                    </button>
                </form>
            </div>
        </section>
    );
}

/* ==========================================================================
   Component: SubjectCard
   ========================================================================== */
function SubjectCard({ subject }) {
    const percent = subject.totalGoals > 0
        ? Math.round((subject.completedGoals / subject.totalGoals) * 100)
        : 0;

    return (
        <div className="subject-card">
            <div className="subject-card-top">
                <div className="subject-name-group">
                    <span className="subject-bullet"></span>
                    <span className="subject-name">{subject.name}</span>
                </div>
                <span className="subject-counter">{subject.completedGoals}/{subject.totalGoals} done</span>
            </div>
            <div className="subject-stats-row">
                <span className="subject-completed-text">{percent}% completed</span>
                <span>{subject.totalGoals - subject.completedGoals} pending</span>
            </div>
            <div className="subject-progress-bg">
                <div className="subject-progress-fill" style={{ width: `${percent}%` }}></div>
            </div>
        </div>
    );
}

/* ==========================================================================
   Component: SubjectsList
   ========================================================================== */
function SubjectsList({ subjects }) {
    return (
        <section className="subjects-section" id="subjects-section" aria-label="Subject Breakdown">
            <div className="card-box subjects-card">
                <div className="card-box-header">
                    <div className="header-icon-box subjects-icon-box">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                        </svg>
                    </div>
                    <div>
                        <h2 className="card-title">Subject Breakdown</h2>
                        <p className="card-subtitle">Goals grouped by subject area</p>
                    </div>
                </div>

                <div className="subjects-list" id="subjects-list">
                    {subjects.length === 0 ? (
                        <div className="subjects-empty">
                            <p>No subjects yet.</p>
                            <p style={{ marginTop: '0.25rem', fontSize: '0.8rem' }}>
                                Subjects appear here automatically when you add goals.
                            </p>
                        </div>
                    ) : (
                        subjects.map(subj => (
                            <SubjectCard key={subj.name} subject={subj} />
                        ))
                    )}
                </div>
            </div>
        </section>
    );
}

/* ==========================================================================
   Component: Footer
   ========================================================================== */
function Footer() {
    return (
        <footer className="app-footer">
            <p>Smart Study Planner &bull; Built with pure React, HTML5, and Modern CSS</p>
        </footer>
    );
}

/* ==========================================================================
   LocalStorage Persistence & Sanitization
   ========================================================================== */
const STORAGE_KEY = 'study_planner_goals';

/**
 * Validates and sanitizes a single goal record loaded from localStorage.
 * Ensures the app never crashes from malformed, legacy, or corrupted records.
 */
function sanitizeGoal(raw, index) {
    if (!raw || typeof raw !== 'object') return null;
    const validPriorities = ['High', 'Medium', 'Low'];
    const rawPriority = typeof raw.priority === 'string' ? raw.priority.trim() : '';
    const priority = validPriorities.includes(rawPriority) ? rawPriority : 'Medium';

    const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : `Goal ${index + 1}`;
    const subject = typeof raw.subject === 'string' && raw.subject.trim() ? raw.subject.trim() : 'General';
    const id = typeof raw.id === 'string' && raw.id ? raw.id : `goal_${Date.now()}_${index}`;
    const targetDate = typeof raw.targetDate === 'string' ? raw.targetDate.trim() : '';
    const completed = Boolean(raw.completed);
    const createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : Date.now();

    return {
        id,
        title,
        subject,
        priority,
        targetDate,
        completed,
        createdAt
    };
}

/**
 * Safely loads and validates goals array from localStorage.
 * Gracefully handles missing, corrupted, or non-array data without crashing.
 */
function loadGoalsFromStorage() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return [];
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((item, idx) => sanitizeGoal(item, idx)).filter(Boolean);
    } catch (e) {
        console.warn('Invalid or corrupted localStorage data detected; starting safely with empty planner.', e);
        return [];
    }
}

/* ==========================================================================
   Main App Component
   ========================================================================== */
function App() {
    // 1. Central Goals State with LocalStorage Initialization
    const [goals, setGoals] = useState(() => loadGoalsFromStorage());

    // 2. Active Filter State: 'all' | 'pending' | 'completed'
    const [currentFilter, setCurrentFilter] = useState('all');

    // 3. Active Navigation State
    const [activeNav, setActiveNav] = useState('dashboard');

    // Highlighted goal state for "Start Now" smooth focus animation
    const [highlightedGoalId, setHighlightedGoalId] = useState(null);

    // Ref for focusing the goal title input from empty states or sidebar
    const titleInputRef = useRef(null);

    // Ref tracking initial mount to avoid redundant initial localStorage write
    const isInitialMount = useRef(true);

    // 4. LocalStorage Synchronization Effect
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
        } catch (e) {
            console.error('Failed to save goals to localStorage:', e);
        }
    }, [goals]);

    // 5. Actions / State Mutation Handlers
    const handleAddGoal = (goalData) => {
        const newGoal = {
            id: 'goal_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            title: goalData.title,
            subject: goalData.subject,
            priority: goalData.priority,
            targetDate: goalData.targetDate,
            completed: false,
            createdAt: Date.now()
        };
        // Add new goal to front of list
        setGoals(prev => [newGoal, ...prev]);
    };

    const handleToggleComplete = (goalId) => {
        setGoals(prev => prev.map(goal => {
            if (goal.id === goalId) {
                return { ...goal, completed: !goal.completed };
            }
            return goal;
        }));
    };

    const handleDeleteGoal = (goalId) => {
        setGoals(prev => prev.filter(goal => goal.id !== goalId));
    };

    const handleLoadDemoGoals = () => {
        const sampleGoals = [
            {
                id: 'demo_1',
                title: 'Review Calculus derivatives & integration techniques',
                subject: 'Mathematics',
                priority: 'High',
                targetDate: getLocalDateOffset(0), // Due Today
                completed: false,
                createdAt: Date.now() - 400000
            },
            {
                id: 'demo_2',
                title: 'Solve kinematics & Newton laws practice problems',
                subject: 'Physics',
                priority: 'High',
                targetDate: getLocalDateOffset(1), // Due Tomorrow
                completed: false,
                createdAt: Date.now() - 300000
            },
            {
                id: 'demo_3',
                title: 'Implement Binary Search Trees & Graph traversal algorithms',
                subject: 'Computer Science',
                priority: 'Medium',
                targetDate: getLocalDateOffset(3), // Due in 3 days
                completed: false,
                createdAt: Date.now() - 200000
            },
            {
                id: 'demo_4',
                title: 'Submit Data Structures laboratory report on AVL Trees',
                subject: 'Computer Science',
                priority: 'High',
                targetDate: getLocalDateOffset(-2), // Overdue by 2 days
                completed: false,
                createdAt: Date.now() - 500000
            },
            {
                id: 'demo_5',
                title: 'Organic Chemistry: reaction mechanisms & syntheses review',
                subject: 'Chemistry',
                priority: 'Low',
                targetDate: getLocalDateOffset(-1), // Completed overdue (never marked overdue)
                completed: true,
                createdAt: Date.now() - 600000
            },
            {
                id: 'demo_6',
                title: 'Prepare presentation on World War II diplomatic history',
                subject: 'History',
                priority: 'Medium',
                targetDate: getLocalDateOffset(7), // Due later than 3 days
                completed: false,
                createdAt: Date.now() - 100000
            }
        ];
        setGoals(sampleGoals);
    };

    const handleFocusForm = () => {
        setActiveNav('create-goal');
        const formElement = document.getElementById('create-goal-section');
        if (formElement) {
            formElement.scrollIntoView({ behavior: 'smooth' });
        }
        if (titleInputRef.current) {
            titleInputRef.current.focus();
        }
    };

    const handleNavClick = (navId, href) => {
        setActiveNav(navId);
        const target = document.querySelector(href);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // 5. Actions / State Mutation Handlers
    const todayStr = getTodayLocalDate();

    const handleStartNow = (goalId) => {
        // If current filter hides this goal, reset filter to 'all' so it is visible
        if (currentFilter === 'completed') {
            setCurrentFilter('all');
        }
        setActiveNav('goals');
        setHighlightedGoalId(goalId);

        setTimeout(() => {
            const el = document.getElementById(`goal-card-${goalId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 50);

        setTimeout(() => {
            setHighlightedGoalId(null);
        }, 2200);
    };

    // 6. Derived Statistics (Computed via useMemo)
    const stats = useMemo(() => {
        const total = goals.length;
        const completed = goals.filter(g => g.completed).length;
        const pending = total - completed;

        // Count incomplete goals whose deadline is today, tomorrow, or within the next 3 days
        const dueSoon = goals.filter(g => {
            if (g.completed || !g.targetDate) return false;
            const diff = getLocalDayDifference(g.targetDate, todayStr);
            return diff !== null && diff >= 0 && diff <= 3;
        }).length;

        const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
        return { total, completed, pending, dueSoon, progress };
    }, [goals, todayStr]);

    // 6.5 Recommended Next Goal (Deterministic Rule-Based Selection)
    const recommendedGoal = useMemo(() => {
        return getRecommendedGoal(goals, todayStr);
    }, [goals, todayStr]);

    // 7. Filtered Goals List
    const filteredGoals = useMemo(() => {
        if (currentFilter === 'pending') {
            return goals.filter(g => !g.completed);
        }
        if (currentFilter === 'completed') {
            return goals.filter(g => g.completed);
        }
        return goals;
    }, [goals, currentFilter]);

    // 8. Aggregated Subjects Breakdown
    const subjects = useMemo(() => {
        const map = {};
        goals.forEach(goal => {
            const trimmed = goal.subject.trim();
            if (!trimmed) return;
            if (!map[trimmed]) {
                map[trimmed] = { name: trimmed, totalGoals: 0, completedGoals: 0 };
            }
            map[trimmed].totalGoals += 1;
            if (goal.completed) {
                map[trimmed].completedGoals += 1;
            }
        });
        const arr = Object.values(map);
        arr.sort((a, b) => a.name.localeCompare(b.name));
        return arr;
    }, [goals]);

    // Unique subject names for the datalist
    const availableSubjectNames = useMemo(() => {
        return subjects.map(s => s.name);
    }, [subjects]);

    // SVG icons for Overview Statistics Cards
    const statIcons = {
        total: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
        ),
        completed: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
        ),
        dueSoon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
            </svg>
        ),
        pending: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
            </svg>
        ),
        progress: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M16 12l-4-4-4 4M12 16V8"/>
            </svg>
        )
    };

    return (
        <div className="app-layout">
            {/* Sidebar Navigation */}
            <Sidebar activeNav={activeNav} onNavClick={handleNavClick} />

            {/* Main Application Content Area */}
            <main className="main-wrapper" id="dashboard">
                {/* Header */}
                <Header onLoadDemoGoals={handleLoadDemoGoals} />

                {/* Dashboard Container */}
                <div className="dashboard-container">
                    {/* Overview Statistics Section */}
                    <section className="stats-section" aria-label="Study Statistics">
                        <div className="section-header">
                            <div>
                                <h2 className="section-title">Overview Statistics</h2>
                                <p className="section-subtitle">Real-time breakdown of your learning milestones</p>
                            </div>
                        </div>

                        <div className="stats-grid" id="stats-container">
                            <StatCard
                                title="Total Goals"
                                value={stats.total}
                                type="total"
                                icon={statIcons.total}
                            />
                            <StatCard
                                title="Completed Goals"
                                value={stats.completed}
                                type="completed"
                                icon={statIcons.completed}
                            />
                            <StatCard
                                title="Due Soon"
                                value={stats.dueSoon}
                                type="due-soon"
                                icon={statIcons.dueSoon}
                            />
                            <StatCard
                                title="Overall Progress"
                                value={stats.progress}
                                type="progress"
                                icon={statIcons.progress}
                                isProgress={true}
                            />
                        </div>
                    </section>

                    {/* Recommended Next Goal Section */}
                    <RecommendedGoal
                        goal={recommendedGoal}
                        todayStr={todayStr}
                        onStartNow={handleStartNow}
                        totalGoalsCount={goals.length}
                        pendingGoalsCount={stats.pending}
                    />

                    {/* Two-Column Workspace Layout */}
                    <div className="workspace-grid">
                        {/* Left Column: Study Goals */}
                        <section className="goals-section" id="goals-section" aria-label="Study Goals List">
                            <div className="goals-header-bar">
                                <div>
                                    <h2 className="section-title">Study Goals</h2>
                                    <p className="section-subtitle">Your active academic milestones and deadlines</p>
                                </div>
                                <FilterTabs
                                    currentFilter={currentFilter}
                                    onFilterChange={setCurrentFilter}
                                />
                            </div>

                            <GoalList
                                goals={filteredGoals}
                                currentFilter={currentFilter}
                                totalCount={goals.length}
                                todayStr={todayStr}
                                highlightedGoalId={highlightedGoalId}
                                onToggleComplete={handleToggleComplete}
                                onDelete={handleDeleteGoal}
                                onFocusForm={handleFocusForm}
                            />
                        </section>

                        {/* Right Column: Create Goal Form & Subjects Breakdown */}
                        <div className="side-column">
                            <GoalForm
                                onAddGoal={handleAddGoal}
                                availableSubjects={availableSubjectNames}
                                titleInputRef={titleInputRef}
                            />

                            <SubjectsList subjects={subjects} />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <Footer />
            </main>
        </div>
    );
}

/* ==========================================================================
   Application Mount
   ========================================================================== */
const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);
root.render(<App />);
