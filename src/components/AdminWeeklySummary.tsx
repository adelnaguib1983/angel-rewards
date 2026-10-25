import React from 'react';

export function AdminWeeklySummary() {
  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Weekly Summary</h2>
      <p className="text-gray-600 mb-6">
        Welcome to the Weekly Summary dashboard. Here you can review performance, statistics, and reports for the week.
      </p>
      
      <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
        Weekly summary data and reports will appear here.
      </div>
    </div>
  );
}
