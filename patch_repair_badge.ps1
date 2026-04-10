$f = 'c:\Users\den-a\SE\tailoring-management-user\src\admin\repair.jsx'
$lines = [System.IO.File]::ReadAllLines($f)
$lines[3033] = '                          if (pf.enhancementRequest && (pf.enhancementAdminAccepted || pf.addAccessories)) {'
$lines[3035] = '                              <div style={{ fontSize: ''11px'', color: ''#673ab7'', marginTop: ''4px'', fontWeight: ''600'' }}>'
$lines[3036] = '                                {pf.addAccessories && !pf.enhancementAdminAccepted ? ''Enhancement + Accessories'' : ''Enhancement''}'
$lines[3037] = '                              </div>'
[System.IO.File]::WriteAllLines($f, $lines)
Write-Output 'Done'
