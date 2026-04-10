$f = 'c:\Users\den-a\SE\tailoring-management-user\src\user\Profile.jsx'
$lines = [System.IO.File]::ReadAllLines($f)
$insert = @(
  '              <div style={{ marginTop: ''14px'' }}>',
  '                <label style={{ display: ''flex'', alignItems: ''center'', gap: ''8px'', cursor: ''pointer'', fontWeight: ''600'', color: ''#333'' }}>',
  '                  <input',
  '                    type="checkbox"',
  '                    checked={enhanceAddAccessories}',
  '                    onChange={(e) => setEnhanceAddAccessories(e.target.checked)}',
  '                    style={{ width: ''16px'', height: ''16px'', cursor: ''pointer'' }}',
  '                  />',
  '                  Add Accessories (optional)',
  '                </label>',
  '                {enhanceAddAccessories && (',
  '                  <p style={{ marginTop: ''6px'', fontSize: ''13px'', color: ''#e65100'' }}>',
  '                    ⚠️ Adding accessories requires additional payment. The admin will provide the price for your confirmation.',
  '                  </p>',
  '                )}',
  '              </div>'
)
# Insert after line index 4281 (0-based)
$newLines = $lines[0..4281] + $insert + $lines[4282..($lines.Count-1)]
[System.IO.File]::WriteAllLines($f, $newLines)
Write-Output 'Done'
