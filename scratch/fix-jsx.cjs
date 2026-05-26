const fs = require('fs');
const path = 'c:/Goatbar-system/src/routes/controladoria.tsx';
let code = fs.readFileSync(path, 'utf8');

// I will just balance the divs at the end.
// We know that `showModal` wraps:
// <div className="fixed inset-0 ...
//   <div className="absolute inset-0 ... />
//   <div className="relative w-full ...
//     <div className="px-6 py-4 ...> Header </div>
//     <div className="p-6 max-h-[80vh] ...> Body </div>
//     <div className="p-6 border-t ...> Footer </div>
//   </div>
// </div>

const matchTarget = `                )}
              </div>

            </div>
            
            <div className="p-6 border-t border-border flex justify-end gap-3 bg-primary/5">`;

const replacementTarget = `                )}
              </div>
            </div>
            <div className="p-6 border-t border-border flex justify-end gap-3 bg-primary/5">`;

if (code.includes(matchTarget)) {
    code = code.replace(matchTarget, replacementTarget);
    fs.writeFileSync(path, code);
    console.log("Fixed JSX closing divs via script.");
} else {
    console.log("Could not find the target to fix.");
}
