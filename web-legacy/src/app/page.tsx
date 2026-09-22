export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="glass p-12 max-w-2xl w-full text-center space-y-8">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-white">
          Welcome to TA System
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          Zhejiang University Computer Systems II
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
          <a href="/login?role=student" className="glass p-6 hover:scale-105 transition-transform flex flex-col items-center justify-center space-y-2 cursor-pointer">
            <h2 className="text-2xl font-semibold">Student Portal</h2>
            <p className="text-sm opacity-80">Check grades & boards</p>
          </a>
          <a href="/login?role=ta" className="glass p-6 hover:scale-105 transition-transform flex flex-col items-center justify-center space-y-2 cursor-pointer border-blue-400">
            <h2 className="text-2xl font-semibold text-blue-500">TA / Teacher Portal</h2>
            <p className="text-sm opacity-80">Manage experiments & grading</p>
          </a>
        </div>
      </div>
    </div>
  );
}
