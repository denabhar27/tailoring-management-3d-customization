$f = 'c:\Users\den-a\SE\tailoring-management-user\src\admin\Customize.jsx'
$lines = [System.IO.File]::ReadAllLines($f)
$lines[4016] = '                          if (pf.enhancementRequest && (pf.enhancementAdminAccepted || pf.addAccessories)) {'
$lines[4018] = '                              <div style={{ fontSize: ''11px'', color: ''#673ab7'', marginTop: ''4px'', fontWeight: ''600'' }}>'
$lines[4019] = '                                {pf.addAccessories && !pf.enhancementAdminAccepted ? ''Enhancement + Accessories'' : ''Enhancement''}'
$lines[4020] = '                              </div>'
[System.IO.File]::WriteAllLines($f, $lines)
Write-Output 'Done'
