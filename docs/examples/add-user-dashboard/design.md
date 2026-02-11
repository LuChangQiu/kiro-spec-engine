# User Dashboard - Design

> Technical design for React dashboard feature

---

**Version**: 1.42.0  
**Last Updated**: 2026-02-11

---

## Architecture

**Pattern:** Container/Presentational Components  
**State Management:** React Context + Hooks  
**Styling:** CSS Modules  
**Charts:** Recharts library

---

## Component Design

### Dashboard (Container)
**File:** `src/pages/Dashboard.jsx`

**Responsibilities:**
- Fetch dashboard data
- Manage loading/error states
- Compose child components

**State:**
```javascript
{
  metrics: { total, completed, inProgress, pending },
  chartData: [{ date, count }],
  recentTasks: [{ id, title, status, date }],
  loading: boolean,
  error: string | null
}
```

---

### MetricCard (Presentational)
**File:** `src/components/MetricCard.jsx`

**Props:**
```javascript
{
  title: string,
  value: number,
  change: number, // percentage
  icon: ReactNode
}
```

**Renders:**
- Card container
- Icon
- Title
- Value (large text)
- Change indicator (↑/↓ with color)

---

### TaskCompletionChart (Presentational)
**File:** `src/components/TaskCompletionChart.jsx`

**Props:**
```javascript
{
  data: [{ date: string, count: number }]
}
```

**Implementation:**
- Use Recharts LineChart
- Format dates on X-axis
- Show tooltip on hover
- Responsive container

---

### TaskList (Presentational)
**File:** `src/components/TaskList.jsx`

**Props:**
```javascript
{
  tasks: [{ id, title, status, date }],
  onTaskClick: (id) => void
}
```

---

## State Management

### DashboardContext
**File:** `src/contexts/DashboardContext.jsx`

```javascript
const DashboardContext = createContext();

export function DashboardProvider({ children }) {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);
  
  const fetchDashboardData = async () => {
    // Fetch metrics, chart data, recent tasks
  };
  
  return (
    <DashboardContext.Provider value={{ state, fetchDashboardData }}>
      {children}
    </DashboardContext.Provider>
  );
}
```

---

## API Integration

### useDashboard Hook
**File:** `src/hooks/useDashboard.js`

```javascript
export function useDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [metrics, chartData, tasks] = await Promise.all([
          api.get('/dashboard/metrics'),
          api.get('/dashboard/chart-data'),
          api.get('/tasks?limit=5&sort=recent')
        ]);
        setData({ metrics, chartData, tasks });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return { data, loading, error };
}
```

---

## Styling

### Responsive Grid
```css
.dashboard {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
  padding: 24px;
}

@media (max-width: 768px) {
  .dashboard {
    grid-template-columns: 1fr;
  }
}
```

---

## Requirements Traceability

| Requirement | Component | File |
|-------------|-----------|------|
| US-1 | MetricCard | MetricCard.jsx |
| US-2 | TaskCompletionChart | TaskCompletionChart.jsx |
| US-3 | TaskList | TaskList.jsx |
| FR-1 | Dashboard | Dashboard.jsx |
| FR-2 | MetricCard | MetricCard.jsx |
| FR-3 | TaskCompletionChart | TaskCompletionChart.jsx |
| FR-4 | TaskList | TaskList.jsx |

---

**Version**: 1.42.0  
**Last Updated**: 2026-02-11
