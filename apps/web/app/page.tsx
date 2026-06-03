export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        
        {/* Sidebar */}
        <div className="w-64 bg-white h-screen shadow-sm fixed">
          <div className="p-4 border-b">
            <h1 className="text-xl font-bold text-blue-600">FinSmart AI</h1>
            <p className="text-xs text-gray-500">Finance Management</p>
          </div>
          <nav className="p-4">
            {['Dashboard', 'Customers', 'Loans', 'Collections', 'Payments', 'Analytics', 'AI Analysis'].map((item) => (
              <a key={item} href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg mb-1 text-gray-600 hover:bg-blue-50 hover:text-blue-600">
                {item}
              </a>
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div className="ml-64 flex-1 p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
            <p className="text-gray-500">Welcome back, Ramesh Babu 👋</p>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Loan Disbursed', value: '₹12,45,00,000', change: '+18.6%', color: 'blue' },
              { label: 'Total Collections', value: '₹8,75,20,000', change: '+12.4%', color: 'green' },
              { label: 'Active Customers', value: '12,850', change: '+8.7%', color: 'purple' },
              { label: 'NPA (30+ Days)', value: '2.35%', change: '-0.8%', color: 'red' },
            ].map((card) => (
              <div key={card.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{card.value}</p>
                <p className={`text-sm mt-1 ${card.color === 'red' ? 'text-red-500' : 'text-green-500'}`}>
                  {card.change} vs last month
                </p>
              </div>
            ))}
          </div>

          {/* Recent Loans Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="font-semibold text-gray-800 mb-4">Recent Loans</h3>
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="pb-2">Loan ID</th>
                  <th className="pb-2">Customer</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { id: 'LN10001', name: 'Suresh Kumar', type: 'Personal Loan', amount: '₹2,00,000', status: 'Active' },
                  { id: 'LN10002', name: 'Anitha Devi', type: 'Business Loan', amount: '₹5,00,000', status: 'Active' },
                  { id: 'LN10003', name: 'Ravi Teja', type: 'Gold Loan', amount: '₹1,50,000', status: 'Active' },
                ].map((loan) => (
                  <tr key={loan.id} className="border-b text-sm">
                    <td className="py-3 text-blue-600">{loan.id}</td>
                    <td className="py-3">{loan.name}</td>
                    <td className="py-3">{loan.type}</td>
                    <td className="py-3 font-medium">{loan.amount}</td>
                    <td className="py-3">
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs">{loan.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}