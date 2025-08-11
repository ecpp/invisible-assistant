import { useState, useEffect } from 'react';
import { ChevronDown, Monitor, AlertCircle } from 'lucide-react';

interface MonitorInfo {
  id: string;
  name: string;
  isPrimary: boolean;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  workArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  scaleFactor: number;
}

interface MonitorSelectorProps {
  label: string;
  description: string;
  value?: string;
  onChange: (monitorId: string | undefined) => void;
  monitors: MonitorInfo[];
}

export function MonitorSelector({ 
  label, 
  description, 
  value, 
  onChange, 
  monitors 
}: MonitorSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMonitor, setSelectedMonitor] = useState<MonitorInfo | undefined>();

  // Debug logging
  console.log('MonitorSelector render:', { label, monitors: monitors.length, value });

  useEffect(() => {
    // Find the selected monitor or use primary as default
    if (value) {
      const monitor = monitors.find(m => m.id === value);
      setSelectedMonitor(monitor);
    } else {
      // Default to primary monitor
      const primaryMonitor = monitors.find(m => m.isPrimary);
      setSelectedMonitor(primaryMonitor);
    }
  }, [value, monitors]);

  const handleSelect = (monitor: MonitorInfo | undefined) => {
    setSelectedMonitor(monitor);
    onChange(monitor?.id);
    setIsOpen(false);
  };

  const formatResolution = (monitor: MonitorInfo) => {
    return `${monitor.bounds.width} × ${monitor.bounds.height}`;
  };

  const formatPosition = (monitor: MonitorInfo) => {
    return `(${monitor.bounds.x}, ${monitor.bounds.y})`;
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-white">{label}</label>
      <p className="text-xs text-white/60">{description}</p>
      
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-white text-left flex items-center justify-between hover:bg-black/60 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-white/70" />
            <span className="text-sm">
              {selectedMonitor ? (
                <>
                  {selectedMonitor.name}
                  <span className="text-white/50 ml-2 text-xs">
                    {formatResolution(selectedMonitor)}
                  </span>
                </>
              ) : (
                <span className="text-white/50">Select a monitor</span>
              )}
            </span>
          </div>
          <ChevronDown className={`w-4 h-4 text-white/70 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-black/95 border border-white/10 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
            {/* Auto-detect option */}
            <button
              onClick={() => handleSelect(undefined)}
              className={`w-full px-3 py-2 text-left hover:bg-white/10 transition-colors ${
                !value ? 'bg-white/5' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${!value ? 'bg-white' : 'bg-white/20'}`} />
                <div>
                  <p className="text-sm text-white">Auto-detect (Primary)</p>
                  <p className="text-xs text-white/50">Use the primary monitor automatically</p>
                </div>
              </div>
            </button>

            <div className="border-t border-white/10 my-1" />

            {/* Monitor options */}
            {monitors.length > 0 ? monitors.map((monitor) => (
              <button
                key={monitor.id}
                onClick={() => handleSelect(monitor)}
                className={`w-full px-3 py-2 text-left hover:bg-white/10 transition-colors ${
                  value === monitor.id ? 'bg-white/5' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    value === monitor.id ? 'bg-white' : 'bg-white/20'
                  }`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-white">{monitor.name}</p>
                      {monitor.isPrimary && (
                        <span className="text-xs px-1.5 py-0.5 bg-white/10 rounded text-white/70">
                          Primary
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/50">
                      {formatResolution(monitor)} at {formatPosition(monitor)}
                      {monitor.scaleFactor !== 1 && ` • ${monitor.scaleFactor}x scale`}
                    </p>
                  </div>
                </div>
              </button>
            )) : (
              <div className="px-3 py-2 text-xs text-white/50">
                No monitors available
              </div>
            )}
          </div>
        )}
      </div>

      {monitors.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-yellow-400 mt-2">
          <AlertCircle className="w-3 h-3" />
          <span>No monitors detected. Using default display.</span>
        </div>
      )}

      {monitors.length === 1 && (
        <div className="mt-2 p-2 rounded-md bg-white/5 border border-white/10">
          <p className="text-xs text-white/60">
            ℹ️ Single monitor detected. The application will use this monitor for all operations.
            Connect additional displays to enable monitor selection.
          </p>
        </div>
      )}
    </div>
  );
}