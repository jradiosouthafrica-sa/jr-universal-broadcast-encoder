const channels = [
  { name: "Browser audio", detail: "Website capture · not connected" },
  { name: "Application audio", detail: "Desktop app capture · not connected" },
  { name: "Microphone", detail: "Input device · not selected" },
  { name: "External input", detail: "USB / line input · not selected" }
];

export default function App() {
  return (
    <main className="studio">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">JR</span>
          <div>
            <strong>JRadio</strong>
            <small>UNIVERSAL BROADCAST ENCODER</small>
          </div>
        </div>
        <span className="status"><i /> NOT BROADCASTING</span>
      </header>

      <section className="welcome">
        <p className="eyebrow">BROADCAST CONTROL ROOM</p>
        <h1>Your sound. <span>Your station.</span></h1>
        <p className="intro">Bring supported audio sources together and send one programme feed to your radio server.</p>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">INPUTS</p>
            <h2>Audio channels</h2>
          </div>
          <span className="muted">Prototype interface</span>
        </div>
        <div className="channels">
          {channels.map((channel, index) => (
            <article className="channel" key={channel.name}>
              <div className="channel-number">0{index + 1}</div>
              <div className="channel-copy">
                <strong>{channel.name}</strong>
                <small>{channel.detail}</small>
              </div>
              <div className="meter" aria-label="No audio signal">
                {Array.from({ length: 18 }, (_, i) => <span key={i} />)}
              </div>
              <span className="channel-state">IDLE</span>
            </article>
          ))}
        </div>
      </section>

      <section className="lower-grid">
        <article className="panel">
          <p className="eyebrow">STATION OUTPUT</p>
          <h2>Connection setup</h2>
          <p className="muted">Server connection controls will be added after the audio engine and encoder are in place.</p>
          <div className="placeholder">No streaming server configured</div>
        </article>
        <article className="panel master">
          <p className="eyebrow">MASTER BUS</p>
          <h2>Programme output</h2>
          <div className="master-meter"><span /></div>
          <div className="master-value">— dB</div>
          <button type="button" disabled>START BROADCAST · NOT AVAILABLE YET</button>
        </article>
      </section>

      <footer>JRadio Universal Broadcast Encoder <span>Free and open-source project · Development build</span></footer>
    </main>
  );
}
