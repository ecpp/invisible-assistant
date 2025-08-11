// Test script to verify Windows monitor name detection
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function testMonitorNameDetection() {
  console.log('=== TESTING MONITOR NAME DETECTION ===\n');
  console.log('Expected monitor name: TL140ADXP01\n');
  
  // Test 1: WMI MonitorID Method
  console.log('Test 1: Using WmiMonitorID (CIM Instance)...');
  try {
    const powershellCommand = [
      'Get-CimInstance -Namespace root\\wmi -ClassName WmiMonitorID -ErrorAction SilentlyContinue |',
      'ForEach-Object {',
      '  $name = if ($_.UserFriendlyName) { [System.Text.Encoding]::ASCII.GetString($_.UserFriendlyName, 0, $_.UserFriendlyName.Length).Replace([char]0, [string]::Empty).Trim() } else { "" }',
      '  $mfg = if ($_.ManufacturerName) { [System.Text.Encoding]::ASCII.GetString($_.ManufacturerName, 0, $_.ManufacturerName.Length).Replace([char]0, [string]::Empty).Trim() } else { "" }',
      '  Write-Output "Name: $name"',
      '  Write-Output "Manufacturer: $mfg"',
      '  if ($name -ne "") {',
      '    if ($mfg -ne "" -and $mfg -ne $name) { Write-Output "Combined: $mfg $name" } else { Write-Output "Combined: $name" }',
      '  } elseif ($mfg -ne "") {',
      '    Write-Output "Combined: $mfg Monitor"',
      '  } else {',
      '    Write-Output "Combined: Generic Monitor"',
      '  }',
      '  Write-Output "---"',
      '}'
    ].join('; ');
    
    const { stdout } = await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${powershellCommand}"`);
    console.log('WmiMonitorID Output:');
    console.log(stdout);
  } catch (error) {
    console.error('WmiMonitorID failed:', error.message);
  }
  
  // Test 2: Get-PnpDevice Method
  console.log('\nTest 2: Using Get-PnpDevice...');
  try {
    const command = 'Get-PnpDevice -Class Monitor -Status OK | Select-Object -Property FriendlyName, Name, InstanceId | Format-List';
    const { stdout } = await execAsync(`powershell -NoProfile -Command "${command}"`);
    console.log('PnpDevice Output:');
    console.log(stdout);
  } catch (error) {
    console.error('Get-PnpDevice failed:', error.message);
  }
  
  // Test 3: WMIC Method
  console.log('\nTest 3: Using WMIC...');
  try {
    const { stdout } = await execAsync('wmic desktopmonitor get name, caption, description /format:list');
    console.log('WMIC Output:');
    console.log(stdout);
  } catch (error) {
    console.error('WMIC failed:', error.message);
  }
  
  // Test 4: Registry EDID Method
  console.log('\nTest 4: Checking Registry for EDID data...');
  try {
    const regCommand = `Get-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\DISPLAY\\*\\*\\Device Parameters' -Name EDID -ErrorAction SilentlyContinue | ForEach-Object { $_.PSPath }`;
    const { stdout } = await execAsync(`powershell -NoProfile -Command "${regCommand}"`);
    console.log('Registry paths with EDID:');
    console.log(stdout);
    
    // Try to parse EDID for monitor name
    const edidParseCommand = `
      $monitors = Get-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\DISPLAY\\*\\*\\Device Parameters' -Name EDID -ErrorAction SilentlyContinue
      foreach ($monitor in $monitors) {
        if ($monitor.EDID) {
          $edid = $monitor.EDID
          # EDID descriptor blocks start at byte 54
          for ($i = 54; $i -lt 126; $i += 18) {
            if ($edid[$i] -eq 0 -and $edid[$i+1] -eq 0 -and $edid[$i+2] -eq 0 -and $edid[$i+3] -eq 0xFC) {
              # Found monitor name descriptor
              $nameBytes = $edid[($i+5)..($i+17)]
              $name = [System.Text.Encoding]::ASCII.GetString($nameBytes).Replace([char]0, '').Replace([char]0x0A, '').Trim()
              Write-Output "Monitor Name from EDID: $name"
              break
            }
          }
        }
      }
    `;
    const { stdout: edidNames } = await execAsync(`powershell -NoProfile -Command "${edidParseCommand}"`);
    console.log('EDID Parsed Names:');
    console.log(edidNames);
  } catch (error) {
    console.error('Registry EDID check failed:', error.message);
  }
  
  // Test 5: WMI with different approach
  console.log('\nTest 5: Using WMI Win32_DesktopMonitor...');
  try {
    const { stdout } = await execAsync('wmic path Win32_DesktopMonitor get Name, MonitorManufacturer, MonitorType, PNPDeviceID /format:list');
    console.log('Win32_DesktopMonitor Output:');
    console.log(stdout);
  } catch (error) {
    console.error('Win32_DesktopMonitor failed:', error.message);
  }
  
  // Test 6: Get monitor info from display adapter
  console.log('\nTest 6: Checking display configuration...');
  try {
    const displayCommand = `
      Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      using System.Collections.Generic;
      
      public class MonitorInfo {
        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        public static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFOEX lpmi);
        
        [DllImport("user32.dll")]
        public static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr lprcClip, MonitorEnumDelegate lpfnEnum, IntPtr dwData);
        
        public delegate bool MonitorEnumDelegate(IntPtr hMonitor, IntPtr hdcMonitor, ref RECT lprcMonitor, IntPtr dwData);
        
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
        public struct MONITORINFOEX {
          public int Size;
          public RECT Monitor;
          public RECT WorkArea;
          public uint Flags;
          [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
          public string DeviceName;
        }
        
        [StructLayout(LayoutKind.Sequential)]
        public struct RECT {
          public int Left;
          public int Top;
          public int Right;
          public int Bottom;
        }
        
        public static List<string> GetMonitorNames() {
          var names = new List<string>();
          EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero,
            delegate(IntPtr hMonitor, IntPtr hdcMonitor, ref RECT lprcMonitor, IntPtr dwData) {
              MONITORINFOEX mi = new MONITORINFOEX();
              mi.Size = Marshal.SizeOf(mi);
              if (GetMonitorInfo(hMonitor, ref mi)) {
                names.Add(mi.DeviceName);
              }
              return true;
            }, IntPtr.Zero);
          return names;
        }
      }
"@
      [MonitorInfo]::GetMonitorNames() | ForEach-Object { Write-Output "Device: $_" }
    `;
    const { stdout } = await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${displayCommand}"`);
    console.log('Display Device Names:');
    console.log(stdout);
  } catch (error) {
    console.error('Display configuration check failed:', error.message);
  }
  
  console.log('\n=== TEST COMPLETE ===');
  console.log('Look for "TL140ADXP01" in the outputs above to verify detection.');
}

// Run the test
testMonitorNameDetection().catch(console.error);