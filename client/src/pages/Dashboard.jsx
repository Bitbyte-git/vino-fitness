import Operations from './Operations';
import Biometrics from './Biometrics';
import { Brand } from '../components/Brand';
import { DashboardContentSkeleton } from '../components/Skeleton';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Dumbbell, CreditCard, CalendarCheck, ReceiptIndianRupee, ChartNoAxesCombined, Search, Plus, ArrowUpRight, LogOut, Menu, X, ChevronRight, WalletCards, UserCheck, Clock3, Flame, Utensils, Target, Loader2, Fingerprint, IndianRupee, Bell, Settings, Layers, ShieldCheck, CalendarRange, CalendarDays, UserPlus, DoorOpen, FileText, MapPin, Activity } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api, dashboardService, memberService } from '../services';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';

const CHART_COLORS = ['#C6FF00', '#58D68D', '#F6B94A', '#7CC7E8', '#FF6B72'];
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const gymDateKey = (value = new Date()) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value)).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const recentGymDates = count => {
  const [year, month, day] = gymDateKey().split('-').map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, day - (count - 1 - index), 12));
    return date.toISOString().slice(0, 10);
  });
};

const adminNav = [
  [LayoutDashboard, 'Overview', 'dashboard'],
  [Users, 'Members', 'members'],
  [Fingerprint, 'Fingerprints', 'biometrics'],
  [Dumbbell, 'Trainers', 'trainers'],
  [Layers, 'Membership plans', 'plans'],
  [CreditCard, 'Member memberships', 'memberships'],
  [CalendarCheck, 'Check-in & attendance', 'attendance'],
  [ReceiptIndianRupee, 'Payments & receipts', 'payments'],
  [UserPlus, 'Member trainers', 'allocations'],
  [Clock3, 'Daily time slots', 'slots'],
  [CalendarRange, 'Member slot assignments', 'slotAllocations'],
  [DoorOpen, 'Opening hours', 'hours'],
  [CalendarDays, 'Trainer availability', 'availability'],
  [ChartNoAxesCombined, 'Reports', 'reports'],
  [ShieldCheck, 'Staff accounts', 'users'],
  [Bell, 'Notifications', 'notifications'],
  [Settings, 'Settings', 'settings'],
  [FileText, 'Audit trail', 'audit'],
];
const receptionSections = ['dashboard', 'members', 'biometrics', 'plans', 'memberships', 'attendance', 'payments', 'slots', 'slotAllocations', 'notifications'];
const trainerNav = [
  [LayoutDashboard, 'Overview', 'dashboard'],
  [Users, 'My members', 'members'],
  [CalendarCheck, 'My attendance', 'attendance'],
  [Clock3, 'My availability', 'availability'],
  [Bell, 'Notifications', 'notifications'],
];
const memberNav = [
  [Fingerprint, 'Fingerprint', 'biometrics'],
  [LayoutDashboard, 'Overview', 'dashboard'],
  [Users, 'My profile', 'profile'],
  [CreditCard, 'Memberships', 'membership'],
  [CalendarCheck, 'Attendance', 'attendance'],
  [ReceiptIndianRupee, 'Payments', 'payments'],
  [Dumbbell, 'My trainer', 'coach'],
  [Clock3, 'My slot', 'schedule'],
  [Bell, 'Notifications', 'notifications'],
];

export default function Dashboard({ role = 'admin' }) {
  const nav = useNavigate();
  const loc = useLocation();
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState('');
  const { user, logout } = useAuth();

  const current = loc.pathname.split('/').pop();
  const staffWorkspace = role === 'admin' || role === 'reception';
  const links = staffWorkspace ? (role === 'reception' ? adminNav.filter(item => receptionSections.includes(item[2])) : adminNav) : role === 'trainer' ? trainerNav : memberNav;
  const title = links.find(x => x[2] === current)?.[1] || 'Overview';

  const handleLogout = async () => {
    await logout();
    nav('/login');
  };

  return (
    <div className={`app-shell${role === 'member' ? ' member-shell' : ''}${role === 'trainer' ? ' trainer-shell' : ''}${role === 'admin' ? ' admin-shell' : ''}${role === 'reception' ? ' reception-shell admin-shell' : ''}`}>
      <aside className={menu ? 'side open' : 'side'}>
        <div className="side-top">
          <Brand onClick={() => nav('/')} subtitle="UNISEX FITNESS STUDIO" size="md" />
          <button className="close-side" onClick={() => setMenu(false)}>
            <X />
          </button>
        </div>

        <nav>
          {links.map(([Icon, label, path]) => (
            <button
              className={current === path ? 'active' : ''}
              key={path}
              onClick={() => {
                nav(`/${role}/${path}`);
                setMenu(false);
              }}
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>
        <div className="side-bottom">

          <div className="user-chip">
            <span>{user?.name?.split(' ').map(n => n[0]).join('') || 'U'}</span>
            <div>
              <b>{user?.name || 'User'}</b>
              <small>{user?.role ? user.role[0].toUpperCase() + user.role.slice(1) : role}</small>
            </div>
          </div>
          <button onClick={handleLogout}>
            <LogOut />
            Sign out
          </button>
        </div>
      </aside>
      <main className="workspace">
        <header>
          <button className="mobile-menu" onClick={() => setMenu(true)}>
            <Menu />
          </button>
          <div>
            <p className="eyebrow">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
            </p>
            <h1>{title}</h1>
          </div>
          <div className="top-actions">
            <label>
              <Search />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search records…"
              />
            </label>
            {staffWorkspace && (current !== 'dashboard' || user?.role !== 'admin') && <button className="lime-btn" onClick={() => nav('/register')}>
              <Plus /> Register member
            </button>}
            {role === 'member' && current !== 'membership' && <button className="lime-btn" onClick={() => nav('/member/membership')}>
              <CreditCard /> My membership
            </button>}
          </div>
        </header>
        {current === 'dashboard' && <Overview role={role} onNavigate={nav} />}
        {current !== 'dashboard' && (links.some(item => item[2] === current)
          ? current === 'biometrics' ? <Biometrics user={user} /> : <Operations section={current} user={user} query={query} />
          : <div className="dash-content"><p>This section is unavailable for your role.</p></div>)}
      </main>
      {role === 'member' && (
        <nav className="member-mobile-nav" aria-label="Member mobile navigation">
          {[
            [LayoutDashboard, 'Overview', 'dashboard'],
            [CreditCard, 'Plans', 'membership'],
            [CalendarCheck, 'Check-ins', 'attendance'],
            [ReceiptIndianRupee, 'Payments', 'payments'],
          ].map(([Icon, label, path]) => (
            <button
              key={path}
              className={current === path ? 'active' : ''}
              onClick={() => nav(`/member/${path}`)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
          <button className={menu ? 'active' : ''} onClick={() => setMenu(true)}>
            <Menu size={18} />
            <span>More</span>
          </button>
        </nav>
      )}
    </div>
  );
}

function Overview({ role, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [members, setMembers] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [membersError, setMembersError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    loadDashboardData();
  }, [role, user?.role]);

  const loadDashboardData = async () => {
    setLoading(true);
    setLoadError('');
    setMembersError('');
    try {
      const statsResponse = await dashboardService[
        role === 'admin' || role === 'reception' ? 'getAdminStats' :
          role === 'trainer' ? 'getTrainerStats' :
            'getMemberStats'
      ]();
      let dashboardData = statsResponse.data.data;
      if (role === 'admin' && user?.role === 'admin') {
        const attendanceDates = recentGymDates(7);
        const [revenueResult, attendanceResult, membershipsResult, slotsResult] = await Promise.allSettled([
          api.get('/reports/revenue'),
          api.get('/reports/attendance', { params: { startDate: attendanceDates[0], endDate: attendanceDates[6] } }),
          api.get('/reports/memberships'),
          api.get('/reports/slot-utilization'),
        ]);
        if (revenueResult.status === 'fulfilled') {
          const revenueResponse = revenueResult.value;
          const revenueData = revenueResponse.data.data || {};
          const monthlyBreakdown = revenueData.monthlyBreakdown || [];
          const paymentMethods = (revenueData.payments || []).reduce((methods, payment) => {
            const name = payment.paymentMethod || 'unknown';
            const existing = methods.get(name) || { name, value: 0, payments: 0 };
            existing.value += Number(payment.amount) || 0;
            existing.payments += 1;
            methods.set(name, existing);
            return methods;
          }, new Map());
          dashboardData = {
            ...dashboardData,
            revenueTrend: monthlyBreakdown.map(item => ({
              year: item._id.year,
              month: item._id.month,
              revenue: Number(item.total) || 0,
              payments: Number(item.count) || 0,
            })),
            paymentMethodDistribution: [...paymentMethods.values()].sort((a, b) => b.value - a.value),
          };
        }
        if (attendanceResult.status === 'fulfilled') {
          const records = attendanceResult.value.data.data?.attendance || [];
          const counts = records.reduce((totals, record) => {
            const key = gymDateKey(record.checkInTime || record.attendanceDate);
            totals[key] = (totals[key] || 0) + 1;
            return totals;
          }, {});
          dashboardData = {
            ...dashboardData,
            attendanceTrend: attendanceDates.map(date => ({ date, checkIns: counts[date] || 0 })),
          };
        }
        if (membershipsResult.status === 'fulfilled') {
          const byStatus = membershipsResult.value.data.data?.summary?.byStatus || {};
          dashboardData = {
            ...dashboardData,
            membershipDistribution: Object.entries(byStatus).map(([name, value]) => ({ name, value: Number(value) || 0 })),
          };
        }
        if (slotsResult.status === 'fulfilled') {
          const utilization = slotsResult.value.data.data?.utilization || [];
          const groupedSlots = utilization.reduce((groups, slot) => {
            const key = `${slot.name}|${slot.startTime}|${slot.endTime}`;
            const existing = groups.get(key) || {
              name: slot.name,
              time: `${slot.startTime}-${slot.endTime}`,
              members: 0,
              capacity: Number(slot.maxCapacity) || 0,
            };
            existing.members += Number(slot.currentAllocations) || 0;
            existing.capacity = Math.max(existing.capacity, Number(slot.maxCapacity) || 0);
            groups.set(key, existing);
            return groups;
          }, new Map());
          dashboardData = {
            ...dashboardData,
            slotUtilization: [...groupedSlots.values()].map(slot => ({
              ...slot,
              utilization: slot.capacity ? Math.round(slot.members / slot.capacity * 100) : 0,
            })),
          };
        }
      }
      setStats(dashboardData);
    } catch (err) {
      setLoadError(err.response?.data?.error || 'Could not load dashboard data. Please try again.');
      return;
    } finally {
      setLoading(false);
    }
    if (role === 'admin' || role === 'reception') {
      try {
        const membersResponse = await memberService.getAll({ limit: 5 });
        setMembers(membersResponse.data.data.members || []);
      } catch (err) {
        setMembersError(err.response?.data?.error || 'Could not load recent members.');
      }
    }
  };

  if (loading) {
    return <DashboardContentSkeleton role={role} />;
  }
  if (loadError) {
    return (
      <div className="dash-content">
        <div className="table-card management-message error-message" role="alert">
          {loadError}
          <button className="outline-btn" onClick={loadDashboardData}>Retry</button>
        </div>
      </div>
    );
  }
  if (role === 'member') return <MemberOverview user={user} stats={stats} onNavigate={onNavigate} />;
  if (role === 'trainer') return <TrainerOverview user={user} stats={stats} onNavigate={onNavigate} />;

  const trainer = role === 'trainer';
  const staffWorkspace = role === 'admin' || role === 'reception';
  const administrator = user?.role === 'admin';
  const displayStats = trainer ?
    [
      [Users, 'Assigned members', stats?.assignedClients ?? 0, 'Active assignments'],
      [CalendarCheck, "Today's sessions", stats?.todaySessions ?? 0, 'Across your members'],
    ] :
    [
      [Users, 'Total members', stats?.totalMembers ?? 0, 'Registered member profiles'],
      [UserCheck, 'Active members', stats?.activeMembers ?? 0, 'Current membership status'],
      [CalendarCheck, "Today's check-ins", stats?.todayCheckins ?? 0, 'Attendance records'],
      [IndianRupee, 'Monthly revenue', money(stats?.monthlyRevenue), 'Completed payments this month']
    ];

  return (
    <div className="dash-content">
      <div className={`welcome ${administrator ? 'admin-welcome' : ''}`}>
        <div>
          {administrator && <span className="admin-live"><i /> LIVE BUSINESS OVERVIEW</span>}
          <h2>{trainer ? 'Your members are moving.' : administrator ? `Welcome back, ${user?.name || 'Admin'}.` : `Good morning, ${user?.name || 'User'}.`}</h2>
          <p>{trainer ? 'Here is what your coaching day looks like.' : administrator ? 'Monitor performance, revenue and daily operations from one place.' : 'Here\'s the pulse of your gym today.'}</p>
        </div>
        {administrator ? <div className="admin-quick-actions">
          <button className="lime-btn" onClick={() => onNavigate('/register')}><Plus /> Register member</button>
          <button className="outline-btn" onClick={() => onNavigate('/admin/reports')}><ChartNoAxesCombined /> Reports</button>
        </div> : staffWorkspace && <button className="outline-btn" onClick={() => onNavigate(`/${role}/members`)}>View members</button>}
      </div>
      <section className="stats">
        {displayStats.map(([Icon, l, n, s]) => (
          <article key={l}>
            <div><Icon /></div>
            <p>{l}</p>
            <h3>{n}</h3>
            <span><ArrowUpRight /> {s}</span>
          </article>
        ))}
      </section>
      {administrator && <AdminAnalytics stats={stats} onNavigate={onNavigate} />}
      {staffWorkspace && (membersError
        ? <div className="table-card management-message error-message" role="alert">{membersError}</div>
        : <MemberTable compact rows={members} onViewAll={() => onNavigate(`/${role}/members`)} />)}
    </div>
  );
}

function AdminAnalytics({ stats, onNavigate }) {
  const attendanceMap = new Map((stats?.attendanceTrend || []).map(item => [item.date, item.checkIns]));
  const attendance = recentGymDates(7).map(date => ({ date, checkIns: Number(attendanceMap.get(date)) || 0 }));
  const revenueMap = new Map((stats?.revenueTrend || []).map(item => [`${item.year}-${item.month}`, item]));
  const revenue = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(); date.setDate(1); date.setMonth(date.getMonth() - (5 - index));
    const item = revenueMap.get(`${date.getFullYear()}-${date.getMonth() + 1}`) || {};
    return { ...item, revenue: item.revenue || 0, payments: item.payments || 0, label: date.toLocaleDateString('en-IN', { month: 'short' }) };
  });
  const memberships = stats?.membershipDistribution || [];
  const slots = stats?.slotUtilization || [];
  const paymentMethods = stats?.paymentMethodDistribution || [];
  const paymentTotal = paymentMethods.reduce((sum, item) => sum + item.value, 0);
  const tooltipStyle = { background: '#151912', border: '1px solid #252D1B', borderRadius: 8, color: '#F5F7F2' };
  return <>
    <section className="analytics-summary">
      <article>
        <div className="analytics-summary-head"><span>Currently inside</span><Flame size={15} color="var(--color-primary)" /></div>
        <strong>{stats.currentlyCheckedIn || 0}</strong>
        <small>Members checked in now</small>
      </article>
      <article>
        <div className="analytics-summary-head"><span>Active trainers</span><Dumbbell size={15} color="var(--color-primary)" /></div>
        <strong>{stats.activeTrainers || 0}<em> / {stats.totalTrainers || 0}</em></strong>
        <small>Available trainer profiles</small>
      </article>
      <article>
        <div className="analytics-summary-head"><span>Expiring soon</span><Clock3 size={15} color="#F6B94A" /></div>
        <strong>{stats.expiringSoon || 0}</strong>
        <small>Within the next 30 days</small>
      </article>
      <article>
        <div className="analytics-summary-head"><span>Pending dues</span><IndianRupee size={15} color="#FF6B72" /></div>
        <strong>{money(stats.pendingDues)}</strong>
        <small>Outstanding member balance</small>
      </article>
    </section>
    <section className="analytics-grid">
      <article className="analytics-card analytics-wide">
        <ChartTitle eyebrow="ATTENDANCE" title="Check-ins over the last 7 days" />
        <div className="chart-body"><ResponsiveContainer width="100%" height="100%"><AreaChart data={attendance} margin={{ left: -20, right: 8, top: 10 }}>
          <defs><linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C6FF00" stopOpacity={0.25} /><stop offset="100%" stopColor="#C6FF00" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid stroke="#252D1B" vertical={false} /><XAxis dataKey="date" tickFormatter={value => new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Area type="monotone" dataKey="checkIns" stroke="#C6FF00" strokeWidth={3} fill="url(#attendanceFill)" />
        </AreaChart></ResponsiveContainer></div>
      </article>
      <article className="analytics-card">
        <ChartTitle eyebrow="MEMBERSHIPS" title="Status distribution" />
        <div className="donut-layout"><div className="donut-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={memberships} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={3}>{memberships.map((item, index) => <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer><strong>{memberships.reduce((sum, item) => sum + item.value, 0)}<small>Total</small></strong></div><ChartLegend data={memberships} /></div>
      </article>
      <article className="analytics-card analytics-wide">
        <ChartTitle eyebrow="REVENUE" title="Completed payments over 6 months" value={money(revenue.reduce((sum, item) => sum + item.revenue, 0))} />
        <div className="chart-body"><ResponsiveContainer width="100%" height="100%"><BarChart data={revenue} margin={{ left: 4, right: 8, top: 10 }}><CartesianGrid stroke="#252D1B" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} /><YAxis tickFormatter={value => `₹${Math.round(value / 1000)}k`} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} formatter={value => money(value)} /><Bar dataKey="revenue" fill="#C6FF00" radius={[6, 6, 0, 0]} maxBarSize={42} /></BarChart></ResponsiveContainer></div>
      </article>
      <article className="analytics-card">
        <ChartTitle eyebrow="CAPACITY" title="Daily slot utilization" />
        <div className="slot-bars">{slots.length ? slots.map(slot => <div key={`${slot.name}-${slot.time}`}><p><span>{slot.name}<small>{slot.time}</small></span><b>{slot.members}/{slot.capacity}</b></p><div><i style={{ width: `${Math.min(slot.utilization, 100)}%` }} /></div></div>) : <p className="chart-empty">No slot data available.</p>}</div>
      </article>
    </section>
    <section className="analytics-lower-grid">
      <article className="analytics-card payment-mix-card">
        <ChartTitle eyebrow="PAYMENT MIX" title="Revenue by payment channel" value={money(paymentTotal)} />
        <div className="payment-mix">{paymentMethods.length ? paymentMethods.map((method, index) => <div key={method.name}>
          <i style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
          <span><b>{method.name.replaceAll('_', ' ')}</b><small>{method.payments} payment{method.payments === 1 ? '' : 's'}</small></span>
          <strong>{money(method.value)}</strong>
          <em>{paymentTotal ? Math.round(method.value / paymentTotal * 100) : 0}%</em>
        </div>) : <p className="chart-empty">Completed payments will appear here.</p>}</div>
      </article>
      <article className="analytics-card admin-actions-card">
        <ChartTitle eyebrow="QUICK MANAGEMENT" title="Common admin actions" />
        <div className="admin-action-grid">
          <button onClick={() => onNavigate('/admin/members')}><Users /><span><b>Members</b><small>Profiles and status</small></span><ChevronRight /></button>
          <button onClick={() => onNavigate('/admin/attendance')}><CalendarCheck /><span><b>Attendance</b><small>Check-ins and history</small></span><ChevronRight /></button>
          <button onClick={() => onNavigate('/admin/payments')}><ReceiptIndianRupee /><span><b>Payments</b><small>Revenue and receipts</small></span><ChevronRight /></button>
          <button onClick={() => onNavigate('/admin/memberships')}><CreditCard /><span><b>Memberships</b><small>Plans and renewals</small></span><ChevronRight /></button>
        </div>
      </article>
    </section>
  </>;
}

function ChartTitle({ eyebrow, title, value }) {
  return <div className="analytics-head"><div><span>{eyebrow}</span><h3>{title}</h3></div>{value && <strong>{value}</strong>}</div>;
}

function ChartLegend({ data }) {
  return <div className="chart-legend">{data.map((item, index) => <p key={item.name}><i style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} /><span>{item.name.replaceAll('_', ' ')}</span><b>{item.value}</b></p>)}</div>;
}

function MemberOverview({ user, stats, onNavigate }) {
  const membership = stats?.membership;
  const attendance = stats?.todayAttendance;
  const member = stats?.member || user?.profile;
  return (
    <div className="dash-content">
      <div className="welcome">
        <div>
          <h2>Keep showing up, {user?.name || 'Member'}.</h2>
          <p>Your membership and attendance information from Vino Fitness Studio.</p>
        </div>
        <button className="outline-btn" onClick={() => onNavigate('/member/attendance')}>View attendance</button>
      </div>
      <section className="member-hero">
        <article>
          <span>MEMBERSHIP</span>
          <b>{membership?.status?.toUpperCase() || 'NO ACTIVE PLAN'}</b>
          <h2>{membership?.membershipPlan?.name || 'Membership not active'}</h2>
          {membership?.membershipPlan && (
            <div className="membership-plan-cost-badge">
              <strong>{money(membership.membershipPlan.price ?? membership.totalAmount)}</strong>
              {membership.membershipPlan.duration && (
                <small>· {membership.membershipPlan.duration} {membership.membershipPlan.duration === 1 ? 'Month' : 'Months'}</small>
              )}
            </div>
          )}
          <p>{membership
            ? `${new Date(membership.startDate).toLocaleDateString()} — ${new Date(membership.endDate).toLocaleDateString()}`
            : 'Contact reception to review membership options.'}</p>
          <div><strong>{membership ? stats?.remainingDays ?? 0 : '—'}</strong><small>days remaining</small></div>
        </article>
        <article className="today">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0 }}>TODAY'S ATTENDANCE</p>
            {attendance?.sessionName && (
              <span className={`session-badge ${attendance.sessionName}`}>
                {attendance.sessionName}
              </span>
            )}
          </div>
          <h2>
            {stats?.todaySpending?.totalMinutes > 0
              ? `${stats.todaySpending.totalHoursFormatted} gym time today`
              : attendance ? 'Attendance recorded' : 'No attendance record'}
          </h2>
          <span><Clock3 /> {attendance?.checkInTime
            ? `Checked in at ${new Date(attendance.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : 'No check-in today'}</span>
          <span><Flame /> {attendance?.checkOutTime
            ? `Latest session: ${attendance.duration >= 60 ? `${Math.floor(attendance.duration / 60)}h ${attendance.duration % 60}m` : `${attendance.duration}m`}`
            : attendance?.checkInTime ? 'Currently active in gym' : 'Attendance tracked at biometric scanner'}</span>
          {stats?.todaySpending?.breakdown && stats.todaySpending.totalMinutes > 0 && (
            <small style={{ color: 'var(--muted)', marginTop: '4px', display: 'block', fontSize: '11px' }}>
              Morning: {stats.todaySpending.breakdown.morningFormatted} · Afternoon: {stats.todaySpending.breakdown.afternoonFormatted} · Evening: {stats.todaySpending.breakdown.eveningFormatted}
            </small>
          )}
        </article>
        <article className="coach">
          <p>YOUR PROFILE</p>
          <div>
            {member?.profilePicture ? (
              <img
                src={member.profilePicture}
                alt={member?.fullName || 'Profile'}
                style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--color-primary, #C6FF00)' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.nextElementSibling) e.currentTarget.nextElementSibling.style.display = 'grid';
                }}
              />
            ) : null}
            <i style={{ display: member?.profilePicture ? 'none' : 'grid' }}>{member?.avatarInitials || 'M'}</i>
            <h3>{member?.fullName || user?.name || 'Member'}<small>{member?.fitnessGoal?.replaceAll('_', ' ') || 'Fitness goal not set'}</small></h3>
          </div>
          <span>{member?.height ? `${member.height} cm` : 'Height not recorded'} · {member?.weight ? `${member.weight} kg` : 'Weight not recorded'}</span>
        </article>
      </section>
      <section className="member-quick-section">
        <div className="member-quick-head">
          <span>QUICK ACCESS</span>
          <h3>Your fitness hub</h3>
        </div>
        <div className="member-quick-grid">
          <button onClick={() => onNavigate('/member/membership')}>
            <CreditCard size={18} />
            <span><b>Memberships</b><small>Renew, switch slot &amp; pay</small></span>
            <ChevronRight size={16} />
          </button>
          <button onClick={() => onNavigate('/member/attendance')}>
            <CalendarCheck size={18} />
            <span><b>Attendance</b><small>Daily check-ins &amp; duration</small></span>
            <ChevronRight size={16} />
          </button>
          <button onClick={() => onNavigate('/member/payments')}>
            <ReceiptIndianRupee size={18} />
            <span><b>Payments</b><small>Invoices &amp; transaction history</small></span>
            <ChevronRight size={16} />
          </button>
          <button onClick={() => onNavigate('/member/coach')}>
            <Dumbbell size={18} />
            <span><b>My Trainer</b><small>Assigned coach details</small></span>
            <ChevronRight size={16} />
          </button>
          <button onClick={() => onNavigate('/member/schedule')}>
            <Clock3 size={18} />
            <span><b>My Slot</b><small>Daily gym session timing</small></span>
            <ChevronRight size={16} />
          </button>
          <button onClick={() => onNavigate('/member/biometrics')}>
            <Fingerprint size={18} />
            <span><b>Fingerprint ID</b><small>Biometric scanner status</small></span>
            <ChevronRight size={16} />
          </button>
        </div>
      </section>
    </div>
  );
}

function MemberTable({ compact = false, rows = [], onViewAll }) {
  return (
    <section className="table-card">
      <div className="card-head">
        <div>
          <p>{compact ? 'RECENT MEMBERS' : 'DIRECTORY'}</p>
          <h3>{compact ? 'Latest registrations' : 'All members'}</h3>
        </div>
        {compact && <button onClick={onViewAll}>View all <ChevronRight /></button>}
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Mobile</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(m => (
              <tr key={m._id}>
                <td>
                  <div className="member-cell">
                    {m.profilePicture ? (
                      <img
                        src={m.profilePicture}
                        alt={m.fullName || 'Member'}
                        style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--color-primary, #C6FF00)', flexShrink: 0 }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          if (e.currentTarget.nextElementSibling) e.currentTarget.nextElementSibling.style.display = 'grid';
                        }}
                      />
                    ) : null}
                    <i style={{ display: m.profilePicture ? 'none' : 'grid' }}>{m.avatarInitials || m.fullName?.split(' ').map(n => n[0]).join('') || 'M'}</i>
                    <span>
                      <b>{m.fullName || 'Unknown'}</b>
                      <small>{m.memberId || m._id}</small>
                    </span>
                  </div>
                </td>
                <td>{m.mobileNumber || '—'}</td>
                <td><span className={'status ' + (m.registrationStatus || 'pending').toLowerCase()}>{m.registrationStatus || 'Pending'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TrainerOverview({ user, stats, onNavigate }) {
  const trainer = stats?.trainer;
  const attendanceTrend = stats?.attendanceTrend || [];
  const goalDistribution = stats?.goalDistribution || [];
  const assignedMembers = stats?.assignedMembers || [];
  const availability = stats?.availability || [];
  const currentlyCheckedIn = stats?.currentlyCheckedIn || 0;
  const assignedClients = stats?.assignedClients || 0;
  const todaySessions = stats?.todaySessions || 0;
  const weeklyWorkouts = stats?.weeklyWorkouts || 0;

  const tooltipStyle = { background: '#151912', border: '1px solid #252D1B', borderRadius: 8, color: '#F5F7F2' };

  return (
    <div className="dash-content trainer-dashboard-content">
      {/* 1. Trainer Hero Card */}
      <div className="trainer-hero-card">
        <div className="trainer-hero-info">
          <div className="trainer-avatar-ring">
            <span>{user?.name ? user.name.slice(0, 2).toUpperCase() : 'TR'}</span>
          </div>
          <div>
            <div className="trainer-hero-badge-row">
              <span className="trainer-badge-specialty">
                <Dumbbell size={13} /> {trainer?.specialization || 'Fitness Coach'}
              </span>
              {trainer?.experience ? (
                <span className="trainer-badge-exp">{trainer.experience} Yrs Coaching</span>
              ) : null}
            </div>
            <h2>Coach {user?.name || 'Trainer'}</h2>
            <p>Your studio coaching dashboard. Track client check-ins, fitness goals and schedule.</p>
          </div>
        </div>

        <div className="trainer-hero-actions-cluster">
          {currentlyCheckedIn > 0 ? (
            <div className="trainer-live-indicator">
              <span className="live-dot-pulse" />
              <span><b>{currentlyCheckedIn}</b> Client{currentlyCheckedIn === 1 ? '' : 's'} in studio now</span>
            </div>
          ) : (
            <div className="trainer-live-indicator idle">
              <span className="idle-dot" />
              <span>Studio Floor Ready</span>
            </div>
          )}
          <div className="trainer-cta-buttons">
            <button className="lime-btn" onClick={() => onNavigate('/trainer/members')}>
              <Users size={15} /> My Members ({assignedClients})
            </button>
            <button className="outline-btn" onClick={() => onNavigate('/trainer/availability')}>
              <Clock3 size={15} /> Weekly Schedule
            </button>
          </div>
        </div>
      </div>

      {/* 2. KPI Metrics Grid */}
      <section className="trainer-kpi-grid">
        <article className="trainer-kpi-card" onClick={() => onNavigate('/trainer/members')}>
          <div className="kpi-icon-wrap lime">
            <Users size={20} />
          </div>
          <div className="kpi-body">
            <span className="kpi-label">Active Clients</span>
            <h3>{assignedClients}</h3>
            <small className="kpi-sub"><ArrowUpRight size={13} /> Active coaching roster</small>
          </div>
        </article>

        <article className="trainer-kpi-card" onClick={() => onNavigate('/trainer/members')}>
          <div className="kpi-icon-wrap emerald">
            <CalendarCheck size={20} />
          </div>
          <div className="kpi-body">
            <span className="kpi-label">Today's Sessions</span>
            <h3>{todaySessions}</h3>
            <small className="kpi-sub"><Activity size={13} /> Client workouts today</small>
          </div>
        </article>

        <article className="trainer-kpi-card" onClick={() => onNavigate('/trainer/members')}>
          <div className="kpi-icon-wrap orange">
            <Flame size={20} />
          </div>
          <div className="kpi-body">
            <span className="kpi-label">In Studio Now</span>
            <h3>{currentlyCheckedIn}</h3>
            <small className="kpi-sub"><Clock3 size={13} /> Currently active in gym</small>
          </div>
        </article>

        <article className="trainer-kpi-card" onClick={() => onNavigate('/trainer/members')}>
          <div className="kpi-icon-wrap sky">
            <Dumbbell size={20} />
          </div>
          <div className="kpi-body">
            <span className="kpi-label">Weekly Sessions</span>
            <h3>{weeklyWorkouts}</h3>
            <small className="kpi-sub"><Target size={13} /> Completed past 7 days</small>
          </div>
        </article>
      </section>

      {/* 3. Interactive Analytics Grid */}
      <section className="trainer-analytics-grid">
        {/* Attendance Area Chart */}
        <article className="trainer-card chart-wide">
          <div className="trainer-card-head">
            <div>
              <span className="eyebrow-tag">WORKOUT ACTIVITY</span>
              <h3>Client Check-ins (Last 7 Days)</h3>
            </div>
            <span className="trend-badge">{weeklyWorkouts} total this week</span>
          </div>
          <div className="chart-body" style={{ height: 240, marginTop: 14 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendanceTrend} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="trainerAttendanceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C6FF00" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#C6FF00" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#22281e" vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={val => new Date(`${val}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#889082', fontSize: 11 }}
                />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#889082', fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="checkIns" stroke="#C6FF00" strokeWidth={3} fill="url(#trainerAttendanceFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        {/* Client Goals Donut Chart */}
        <article className="trainer-card chart-donut">
          <div className="trainer-card-head">
            <div>
              <span className="eyebrow-tag">CLIENT TARGETS</span>
              <h3>Fitness Goals Breakdown</h3>
            </div>
          </div>
          <div className="donut-layout" style={{ marginTop: 14 }}>
            {goalDistribution.length ? (
              <>
                <div className="donut-chart" style={{ width: 170, height: 170 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={goalDistribution} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={3}>
                        {goalDistribution.map((item, index) => (
                          <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <strong>{assignedClients}<small>Clients</small></strong>
                </div>
                <div className="chart-legend">
                  {goalDistribution.map((item, index) => (
                    <p key={item.name}>
                      <i style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                      <span>{item.name}</span>
                      <b>{item.value}</b>
                    </p>
                  ))}
                </div>
              </>
            ) : (
              <p className="chart-empty">Assigned client goals will appear here.</p>
            )}
          </div>
        </article>
      </section>

      {/* 4. Interactive Bottom Grid: Active Client Roster & Availability Schedule */}
      <section className="trainer-lower-grid">
        {/* Active Client Roster Card */}
        <article className="trainer-card">
          <div className="trainer-card-head">
            <div>
              <span className="eyebrow-tag">ACTIVE ROSTER</span>
              <h3>Assigned Member Directory</h3>
            </div>
            <button className="text-lime-btn" onClick={() => onNavigate('/trainer/members')}>
              View all {assignedClients} <ChevronRight size={14} />
            </button>
          </div>

          <div className="trainer-roster-list">
            {assignedMembers.length ? (
              assignedMembers.map(member => (
                <div key={member._id} className="trainer-roster-item" onClick={() => onNavigate('/trainer/members')}>
                  <div className="roster-avatar">
                    {member.fullName ? member.fullName.slice(0, 2).toUpperCase() : 'M'}
                  </div>
                  <div className="roster-meta">
                    <div className="roster-name-row">
                      <h4>{member.fullName}</h4>
                      <span className="roster-id-pill">{member.memberId}</span>
                    </div>
                    <div className="roster-sub-row">
                      <span className="roster-plan-tag">{member.planName}</span>
                      {member.fitnessGoal && (
                        <span className="roster-goal-tag">
                          {member.fitnessGoal.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="roster-action-arrow">
                    <ChevronRight size={16} />
                  </div>
                </div>
              ))
            ) : (
              <p className="chart-empty">No active client assignments found.</p>
            )}
          </div>
        </article>

        {/* Weekly Working Timings Schedule */}
        <article className="trainer-card">
          <div className="trainer-card-head">
            <div>
              <span className="eyebrow-tag">SCHEDULE</span>
              <h3>Coaching Shifts & Hours</h3>
            </div>
            <button className="text-lime-btn" onClick={() => onNavigate('/trainer/availability')}>
              Full Schedule <ChevronRight size={14} />
            </button>
          </div>

          <div className="trainer-schedule-list">
            {availability.length ? (
              availability.map(slot => (
                <div key={slot._id || slot.dayOfWeek} className="schedule-day-row">
                  <div className="day-name-pill">
                    {slot.dayOfWeek ? slot.dayOfWeek.slice(0, 3).toUpperCase() : 'DAY'}
                  </div>
                  <div className="shift-hours">
                    <strong>{slot.startTime || '06:00'} - {slot.endTime || '22:00'}</strong>
                    {slot.breakStartTime && (
                      <small className="break-note">Break: {slot.breakStartTime} - {slot.breakEndTime}</small>
                    )}
                  </div>
                  <div className="capacity-indicator">
                    <span>Max {slot.maxClients || 5} clients</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="schedule-empty-box">
                <Clock3 size={24} color="var(--lime)" />
                <p>Standard Studio Hours Active</p>
                <small>Mon - Sat (06:00 AM - 10:00 PM)</small>
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
