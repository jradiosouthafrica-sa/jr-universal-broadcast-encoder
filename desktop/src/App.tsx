import { useMemo, useState } from "react";
import { ServerProfile, ServerType, serverTypeLabels, validateServerProfile } from "./serverProfiles";

const channels = [
  { name: "Browser audio", detail: "Website capture · not connected" },
  { name: "Application audio", detail: "Desktop app capture · not connected" },
  { name: "Microphone", detail: "Input device · not selected" },
  { name: "External input", detail: "USB / line input · not selected" }
];
const emptyProfile: ServerProfile = { name: "My station", type: "icecast", host: "", port: "", codec: "mp3", bitrateKbps: "128", mountPoint: "/stream", sourceUsername: "source", sourcePassword: "", streamId: "1" };

export default function App() {
  const [profile, setProfile] = useState<ServerProfile>(emptyProfile);
  const [validationRequested, setValidationRequested] = useState(false);
  const validation = useMemo(() => validateServerProfile(profile), [profile]);
  const update = <K extends keyof ServerProfile>(key: K, value: ServerProfile[K]) => setProfile(current => ({ ...current, [key]: value }));
  const changeType = (type: ServerType) => { setProfile(current => ({ ...current, type })); setValidationRequested(false); };

  return <main className="studio">
    <header className="topbar"><div className="brand"><span className="brand-mark">JR</span><div><strong>JRadio</strong><small>UNIVERSAL BROADCAST ENCODER</small></div></div><span className="status"><i /> NOT BROADCASTING</span></header>
    <section className="welcome"><p className="eyebrow">BROADCAST CONTROL ROOM</p><h1>Your sound. <span>Your station.</span></h1><p className="intro">Bring supported audio sources together and send one programme feed to your radio server.</p></section>
    <section className="panel"><div className="section-heading"><div><p className="eyebrow">INPUTS</p><h2>Audio channels</h2></div><span className="muted">Capture engine not connected</span></div><div className="channels">{channels.map((channel,index)=><article className="channel" key={channel.name}><div className="channel-number">0{index+1}</div><div className="channel-copy"><strong>{channel.name}</strong><small>{channel.detail}</small></div><div className="meter" aria-label="No audio signal">{Array.from({length:18},(_,i)=><span key={i}/>)}</div><span className="channel-state">IDLE</span></article>)}</div></section>
    <section className="panel connection-panel"><div className="section-heading"><div><p className="eyebrow">STATION OUTPUT</p><h2>Streaming server profile</h2></div><span className="muted">Configuration prototype</span></div>
      <div className="form-grid">
        <label>Profile name<input value={profile.name} onChange={e=>update("name",e.target.value)} placeholder="My station"/></label>
        <label>Server type<select value={profile.type} onChange={e=>changeType(e.target.value as ServerType)}>{Object.entries(serverTypeLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
        <label>Server host<input value={profile.host} onChange={e=>update("host",e.target.value)} placeholder="stream.example.com" autoComplete="off"/></label>
        <label>Source port<input value={profile.port} onChange={e=>update("port",e.target.value)} placeholder="e.g. 8000" inputMode="numeric"/></label>
        <label>Audio codec<select value={profile.codec} onChange={e=>update("codec",e.target.value as ServerProfile["codec"])}><option value="mp3">MP3</option><option value="aac">AAC</option><option value="ogg">Ogg Vorbis</option><option value="opus">Opus</option></select></label>
        <label>Bitrate (kbps)<select value={profile.bitrateKbps} onChange={e=>update("bitrateKbps",e.target.value)}>{["64","96","128","160","192","256","320"].map(rate=><option key={rate} value={rate}>{rate} kbps</option>)}</select></label>
        {profile.type==="icecast"&&<><label>Mount point<input value={profile.mountPoint??""} onChange={e=>update("mountPoint",e.target.value)} placeholder="/stream"/></label><label>Source username<input value={profile.sourceUsername??""} onChange={e=>update("sourceUsername",e.target.value)} placeholder="source" autoComplete="off"/></label></>}
        {(profile.type==="shoutcast-v1"||profile.type==="shoutcast-v2")&&<div className="protocol-note">{profile.type==="shoutcast-v1"?"SHOUTcast v1 uses its own source login format. It does not use an Icecast mount-point field.":"SHOUTcast v2 uses a stream ID for the selected station stream."}</div>}
        {profile.type==="shoutcast-v2"&&<label>Stream ID<input value={profile.streamId??""} onChange={e=>update("streamId",e.target.value)} placeholder="1" inputMode="numeric"/></label>}
        {profile.type==="azuracast"&&<div className="protocol-note">Use the live-DJ/source connection details supplied by your AzuraCast station. Exact host, port, username and mount depend on that station's configuration.</div>}
        <label className="full-width">Source password<input type="password" value={profile.sourcePassword} onChange={e=>update("sourcePassword",e.target.value)} placeholder="Enter source password" autoComplete="new-password"/><small className="field-help">Held only in this screen's memory for now. It is not saved to browser storage or sent anywhere.</small></label>
      </div>
      <div className="validation-area"><button type="button" className="validate-button" onClick={()=>setValidationRequested(true)}>VALIDATE PROFILE</button>{validationRequested&&<div className={validation.valid?"validation-success":"validation-errors"}>{validation.valid?"Profile fields look valid. This does not test a server connection.":<ul>{validation.errors.map(error=><li key={error}>{error}</li>)}</ul>}</div>}</div>
    </section>
    <section className="lower-grid"><article className="panel"><p className="eyebrow">MASTER BUS</p><h2>Programme output</h2><div className="master-meter"><span/></div><div className="master-value">— dB</div><p className="muted">The audio mixer and encoder are not connected yet.</p></article><article className="panel master"><p className="eyebrow">BROADCAST STATUS</p><h2>Ready when the engine is</h2><div className="placeholder">Profile validation is local only. No broadcast connection is made.</div><button type="button" disabled>START BROADCAST · NOT AVAILABLE YET</button></article></section>
    <footer>JRadio Universal Broadcast Encoder <span>Free and open-source project · Development build</span></footer>
  </main>;
}
