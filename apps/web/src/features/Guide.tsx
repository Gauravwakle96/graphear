import { Accessibility, Keyboard, FileCheck2, ShieldCheck, Download } from 'lucide-react';
export function Guide() {
  return (
    <section className="guide-page">
      <div className="page-heading">
        <div>
          <h1>A diagram you can work with</h1>
          <p>Explore. Repair. Understand.</p>
        </div>
        <Accessibility size={35} aria-hidden="true" />
      </div>
      <section>
        <h2>
          <Keyboard size={23} aria-hidden="true" /> Keyboard and screen-reader navigation
        </h2>
        <p>
          Use Tab and Shift+Tab to move between controls, Enter or Space to activate buttons, and
          the arrow keys inside native select fields. Each visual step is a labelled button. The
          Explore panel lists every outgoing branch as an ordinary button.
        </p>
        <p>
          Choose a branch to move forward. “Back a step” retraces your current route. “Restart”
          returns to the beginning. A structured text description is available from Export. Optional
          speech stays off until you request it.
        </p>
        <p>
          Hide the canvas to focus on the text controls. Browser zoom, light/dark themes and
          reduced-motion preferences are supported. NVDA and other screen readers use native browser
          semantics; real user testing remains essential.
        </p>
      </section>
      <section>
        <h2>
          <FileCheck2 size={23} aria-hidden="true" /> Import and source review
        </h2>
        <p>
          Import PNG, JPEG, plain SVG or a Graphear JSON graph. The file limit is 5 MB; JSON is
          limited to 1 MB. Simple SVG shapes and connections are read locally. Complex SVGs and
          raster images use English OCR.
        </p>
        <p>
          Image recognition locates text and proposes geometry-based connections. It does not
          establish arrow direction or logical correctness. Inspect each label, type and connection,
          correct them in Edit, then explicitly confirm the reviewed structure.
        </p>
        <p>
          Comparison uses stable IDs. Versions edited from the same imported graph compare best.
          Separate files with different IDs may appear as added and removed items.
        </p>
      </section>
      <section>
        <h2>
          <ShieldCheck size={23} aria-hidden="true" /> Saving and sharing
        </h2>
        <p>
          Original image pixels remain in the browser's import session. Save the graph on this
          device or explicitly save its labels and connections to your private guest workspace. No
          email account is needed.
        </p>
        <p>
          A share link exposes an immutable graph snapshot to anyone holding the link. Original
          image pixels are excluded. Revoke the link from the Share dialog. Creating a replacement
          link invalidates the previous one.
        </p>
        <p>
          Device saves depend on browser storage. Guest workspace access depends on its session
          cookie and expires after 30 days. Keep a portable JSON backup before clearing browser
          data.
        </p>
      </section>
      <section>
        <h2>
          <Download size={23} aria-hidden="true" /> Portable learning packs
        </h2>
        <p>
          Export JSON to reopen/edit the graph, structured text for reading, SVG for visual use, or
          a standalone HTML learning pack containing descriptions and exercises. Exports contain the
          diagram's text, so share them deliberately.
        </p>
      </section>
      <section>
        <h2>About this build</h2>
        <p>
          Graphear is a software prototype for accessible flowchart learning. Its examples and
          repair mission are authored synthetic data. Existing accessible diagram tools informed the
          problem; this implementation joins source review, editing, path comparison and checked
          practice.
        </p>
        <p>
          Manrope fonts use the SIL Open Font License. Icons are from Lucide. OCR uses Tesseract.js.
          Dependency licenses and setup details are documented in the repository.
        </p>
      </section>
    </section>
  );
}
