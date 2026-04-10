$f = 'c:\Users\den-a\SE\tailoring-management-user\src\admin\Customize.jsx'
$lines = [System.IO.File]::ReadAllLines($f)

# 1. Payment button condition (line 4133, 0-based)
$lines[4133] = '                            {(item.approval_status !== ''completed'' && item.approval_status !== ''cancelled'' && item.approval_status !== ''price_confirmation'') && (!isEnhancementOrder || (pricingFactors.accessoriesPrice && remainingBalance > 0.01)) && ('

# 2. Enhancement table accept button title (line 4312, 0-based)
$lines[4312] = '                                  title={pf.addAccessories ? ''Set Accessories Price'' : ''Accept Enhancement''}'

# 3. View modal - add accessories warning after notes div (insert after line 4352)
$accessoriesWarning = @(
  '                {pf.addAccessories && (',
  '                  <div style={{ padding: ''8px 12px'', backgroundColor: ''#fff3e0'', borderRadius: ''6px'', marginBottom: ''12px'', border: ''1px solid #ffcc80'', fontSize: ''13px'', color: ''#e65100'', fontWeight: ''600'' }}>',
  '                    Customer requested to add accessories — price confirmation required.',
  '                  </div>',
  '                )}'
)
$lines = $lines[0..4352] + $accessoriesWarning + $lines[4353..($lines.Count-1)]
[System.IO.File]::WriteAllLines($f, $lines)

# Re-read after insertion
$lines = [System.IO.File]::ReadAllLines($f)

# 4. View modal accept button label (now shifted +5)
# Find the 'Accepting...' line
$acceptLine = ($lines | Select-String "savingEnhancementPrice \? 'Accepting\.\.\.' : 'Accept Enhancement'" | Select-Object -First 1).LineNumber - 1
$lines[$acceptLine] = "                  {savingEnhancementPrice ? 'Processing...' : pf.addAccessories ? 'Set Accessories Price' : 'Accept Enhancement'}"

[System.IO.File]::WriteAllLines($f, $lines)

# 5. Add accessories price modal before the closing of the component
# Find the line with showEnhanceModal to insert before it
$enhanceModalLine = ($lines | Select-String '^\s*\{showEnhanceModal && enhanceOrder' | Select-Object -First 1).LineNumber - 1

$accessoriesModal = @(
  '      {showAccessoriesPriceModal && accessoriesPriceItem && (',
  '        <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && setShowAccessoriesPriceModal(false)}>',
  '          <div className="modal-content" style={{ maxWidth: ''440px'' }}>',
  '            <div className="modal-header">',
  '              <h2>Set Accessories Price</h2>',
  '              <span className="close-modal" onClick={() => setShowAccessoriesPriceModal(false)}>×</span>',
  '            </div>',
  '            <div className="modal-body">',
  '              <div className="detail-row"><strong>Order ID:</strong> #{accessoriesPriceItem.order_id}</div>',
  '              <div className="detail-row"><strong>Current Price:</strong> ₱{parseFloat(accessoriesPriceItem.final_price || 0).toLocaleString()}</div>',
  '              <div style={{ padding: ''8px 12px'', backgroundColor: ''#fff3e0'', borderRadius: ''6px'', margin: ''10px 0'', border: ''1px solid #ffcc80'', fontSize: ''13px'', color: ''#e65100'' }}>',
  '                Customer requested to add accessories. Enter the price below — the customer will be asked to confirm before proceeding.',
  '              </div>',
  '              <div className="payment-form-group" style={{ marginTop: ''12px'' }}>',
  '                <label>Accessories Price (₱) *</label>',
  '                <input',
  '                  type="number"',
  '                  min="0.01"',
  '                  step="0.01"',
  '                  value={accessoriesPrice}',
  '                  onChange={(e) => setAccessoriesPrice(e.target.value)}',
  '                  placeholder="Enter accessories price"',
  '                  style={{ width: ''100%'', padding: ''8px'', border: ''1px solid #ddd'', borderRadius: ''4px'', boxSizing: ''border-box'' }}',
  '                  autoFocus',
  '                />',
  '              </div>',
  '              {accessoriesPrice && !isNaN(parseFloat(accessoriesPrice)) && parseFloat(accessoriesPrice) > 0 && (',
  '                <div style={{ marginTop: ''8px'', padding: ''8px'', backgroundColor: ''#e3f2fd'', borderRadius: ''4px'', fontSize: ''13px'', color: ''#1976d2'' }}>',
  '                  New total: ₱{(parseFloat(accessoriesPriceItem.final_price || 0) + parseFloat(accessoriesPrice)).toLocaleString(''en-US'', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}',
  '                </div>',
  '              )}',
  '            </div>',
  '            <div className="modal-footer">',
  '              <button className="btn-cancel" onClick={() => { setShowAccessoriesPriceModal(false); setAccessoriesPrice(''''); }}>Cancel</button>',
  '              <button',
  '                className="btn-save"',
  '                disabled={savingEnhancementPrice}',
  '                onClick={handleAccessoriesPriceSubmit}',
  '                style={{ background: ''#8b4513'', borderColor: ''#6d3510'', color: ''#fff'' }}',
  '              >',
  '                {savingEnhancementPrice ? ''Sending...'' : ''Send for Confirmation''}',
  '              </button>',
  '            </div>',
  '          </div>',
  '        </div>',
  '      )}',
  ''
)

$lines = $lines[0..($enhanceModalLine-1)] + $accessoriesModal + $lines[$enhanceModalLine..($lines.Count-1)]
[System.IO.File]::WriteAllLines($f, $lines)
Write-Output 'All UI changes applied'
