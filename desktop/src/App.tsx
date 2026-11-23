import { useEffect, useMemo, useRef, useState } from "react";
import { BroadcastAudioEngine, AudioInputDevice, AudioSourceId, listAudioInputDevices } from "./audioEngine";
import { ServerProfile, ServerType, serverTypeLabels, validateServerProfile } from "./serverProfiles";

const emptyProfile: ServerProfile = { name: "My station", type: "icecast", host: "", port: "", codec: "mp3", bitrateKbps: "128", mountPoint: "/stream", sourceUsername: "source", sourcePassword: "", streamId: "1" };
const sourceNames: Record<AudioSourceId, string> = { microphone: "Microphone", desktop: "Desktop / app audio", device: "Soundcard / virtual cable" };

export default function App() {
  const engineRef = useRef<BroadcastAudioEngine | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunkQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [profile, setProfile] = useState<ServerProfile>(emptyProfile);
  const [validationRequested, setValidationRequested] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");
  const [storageBusy, setStorageBusy] = useState(false);
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioMessage, setAudioMessage] = useState("Audio engine is idle. Add a source to create the programme mix.");
  const [active, setActive] = useState<Record<AudioSourceId, boolean>>({ microphone: false, desktop: false, device: false });
  const [muted, setMuted] = useState<Record<AudioSourceId, boolean>>({ microphone: false, desktop: false, device: false });
  const [volumes, setVolumes] = useState<Record<AudioSourceId, number>>({ microphone: 1, desktop: 1, device: 1 });
  const [masterVolume, setMasterVolume] = useState(1);
  const [masterMuted, setMasterMuted] = useState(false);
  const [levels, setLevels] = useState<Record<AudioSourceId, number>>({ microphone: 0, desktop: 0, device: 0 });
  const [masterLevel, setMasterLevel] = useState(0);
  const [mixReady, setMixReady] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [inputDevices, setInputDevices] = useState<AudioInputDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const validation = useMemo(() => validateServerProfile(profile), [profile]);
  const update = <K extends keyof ServerProfile>(key: K, value: ServerProfile[K]) => setProfile(current => ({ ...current, [key]: value }));
  const changeType = (type: ServerType) => { setProfile(current => ({ ...current, type })); setValidationRequested(false); };
  const engine = () => engineRef.current ?? (engineRef.current = new BroadcastAudioEngine());

  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = engineRef.current;
      if (!current) return;
      const micActive = current.isSourceActive("microphone");
      const desktopActive = current.isSourceActive("desktop");
      const deviceActive = current.isSourceActive("device");
      setActive(previous => previous.microphone === micActive && previous.desktop === desktopActive && previous.device === deviceActive ? previous : { microphone: micActive, desktop: desktopActive, device: deviceActive });
      setLevels({ microphone: current.getSourceLevel("microphone"), desktop: current.getSourceLevel("desktop"), device: current.getSourceLevel("device") });
      setMasterLevel(current.getMasterLevel());
      setMixReady(micActive || desktopActive || deviceActive);
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!window.jradio) return;
    return window.jradio.onBroadcastState(event => {
      setAudioMessage(event.message);
      if (event.state === "error" || event.state === "stopped") {
        setBroadcasting(false);
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
        recorderRef.current = null;
      }
    });
  }, []);
  useEffect(() => () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    void window.jradio?.stopBroadcast();
    void engineRef.current?.stop();
  }, []);

  const refreshInputDevices = async () => {
    try {
      setAudioMessage("Requesting temporary microphone permission to identify connected audio devices…");
      const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      permissionStream.getTracks().forEach(track => track.stop());
      const devices = await listAudioInputDevices();
      setInputDevices(devices);
      if (!selectedDeviceId && devices[0]) setSelectedDeviceId(devices[0].deviceId);
      setAudioMessage(devices.length ? "Found " + devices.length + " audio input device(s). Select a soundcard or virtual cable." : "No audio input devices were found.");
    } catch (error) { setAudioMessage(error instanceof Error ? error.message : "Could not list audio input devices."); }
  };
  const capture = async (id: AudioSourceId) => {
    setAudioBusy(true);
    setAudioMessage(id === "microphone" ? "Requesting microphone permission…" : "Opening the system audio sharing picker…");
    try {
      if (id === "microphone") { await engine().addMicrophone(); await refreshInputDevices(); }
      else if (id === "device") await engine().addAudioDevice(selectedDeviceId);
      else await engine().addDesktopAudio();
      setActive(current => ({ ...current, [id]: true }));
      setMuted(current => ({ ...current, [id]: false }));
      setAudioMessage(sourceNames[id] + " is connected to the programme mix.");
    } catch (error) {
      setAudioMessage(error instanceof Error ? error.message : "Could not start this audio source.");
    } finally { setAudioBusy(false); }
  };
  const stopSource = (id: AudioSourceId) => {
    engineRef.current?.stopSource(id);
    setActive(current => ({ ...current, [id]: false }));
    setLevels(current => ({ ...current, [id]: 0 }));
    setAudioMessage(sourceNames[id] + " disconnected.");
  };
  const changeVolume = (id: AudioSourceId, value: number) => {
    const volume = value / 100;
    setVolumes(current => ({ ...current, [id]: volume }));
    engineRef.current?.setSourceVolume(id, volume);
  };
  const toggleMute = (id: AudioSourceId) => {
    const next = !muted[id];
    setMuted(current => ({ ...current, [id]: next }));
    engineRef.current?.setSourceMuted(id, next);
  };
  const changeMasterVolume = (value: number) => {
    const volume = value / 100;
    setMasterVolume(volume);
    engineRef.current?.setMasterVolume(volume);
  };
  const toggleMasterMute = () => {
    const next = !masterMuted;
    setMasterMuted(next);
    engineRef.current?.setMasterMuted(next);
  };
  const startBroadcast = async () => {
    if (profile.type !== "icecast") { setAudioMessage("This first streaming adapter supports Icecast only. SHOUTcast v1/v2 and AzuraCast transports are next."); return; }
    if (!validation.valid) { setValidationRequested(true); setAudioMessage("Complete and validate the Icecast server profile before connecting."); return; }
    if (!window.jradio) { setAudioMessage("Live streaming is available in the installed desktop application, not the browser preview."); return; }
    if (!mixReady) { setAudioMessage("Connect at least one audio source before starting the broadcast."); return; }
    if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) { setAudioMessage("This desktop runtime does not support the required WebM/Opus capture format."); return; }
    setAudioBusy(true); setAudioMessage("Connecting to the Icecast source…");
    try {
      const connected = await window.jradio.startBroadcast(profile);
      if (!connected.ok) throw new Error(connected.error ?? "The Icecast connection was rejected.");
      const recorder = new MediaRecorder(engine().getBroadcastStream(), { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 128000 });
      recorder.ondataavailable = event => { if (event.data.size && window.jradio) chunkQueueRef.current = chunkQueueRef.current.then(async () => { window.jradio?.sendAudioChunk(new Uint8Array(await event.data.arrayBuffer())); }); };
      recorder.onerror = () => { setAudioMessage("Audio capture failed. Stopping the broadcast."); void window.jradio?.stopBroadcast(); setBroadcasting(false); };
      recorder.onstop = () => { recorderRef.current = null; };
      recorderRef.current = recorder; recorder.start(250); setBroadcasting(true);
      setAudioMessage("LIVE · Icecast accepted the source connection. Encoded audio is being sent.");
    } catch (error) { await window.jradio.stopBroadcast(); setBroadcasting(false); setAudioMessage(error instanceof Error ? error.message : "Could not start the broadcast."); }
    finally { setAudioBusy(false); }
  };
  const stopBroadcast = async () => {
    setAudioBusy(true);
    try {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        await new Promise<void>(resolve => { recorder.addEventListener("stop", () => resolve(), { once: true }); recorder.stop(); });
      }
      await chunkQueueRef.current;
      recorderRef.current = null;
      await window.jradio?.stopBroadcast();
      setBroadcasting(false);
      setAudioMessage("Broadcast stopped. Your audio sources remain available in the mixer.");
    }
    finally { setAudioBusy(false); }
  };
  const stopAllAudio = async () => {
    if (broadcasting) await stopBroadcast();
    await engineRef.current?.stop();
    engineRef.current = null;
    setActive({ microphone: false, desktop: false, device: false });
    setLevels({ microphone: 0, desktop: 0, device: 0 });
    setMasterLevel(0);
    setMixReady(false);
    setAudioMessage("All audio sources stopped. Programme mix is closed.");
  };
  const saveProfile = async () => {
    if (!validation.valid) { setValidationRequested(true); setStorageMessage("Correct the profile errors before saving."); return; }
    if (!window.jradio) { setStorageMessage("Secure storage is available only in the desktop application."); return; }
    setStorageBusy(true);
    try {
      const result = await window.jradio.saveProfile(profile);
      setStorageMessage(result.ok ? "Profile saved using encrypted device storage." : result.error ?? "Profile could not be saved.");
    } catch { setStorageMessage("Profile could not be saved."); }
    finally { setStorageBusy(false); }
  };
  const loadProfile = async () => {
    if (!window.jradio) { setStorageMessage("Secure storage is available only in the desktop application."); return; }
    setStorageBusy(true);
    try {
      const result = await window.jradio.loadProfile();
      if (result.ok && result.profile) { setProfile(result.profile); setValidationRequested(false); setStorageMessage("Saved profile loaded from encrypted device storage."); }
      else setStorageMessage(result.ok ? "No saved profile was found on this device." : result.error ?? "Profile could not be loaded.");
    } catch { setStorageMessage("Profile could not be loaded."); }
    finally { setStorageBusy(false); }
  };
  const meterBars = (level: number) => Array.from({ length: 18 }, (_, i) => <span key={i} className={i < Math.round(level * 18) ? "lit" : ""} />);

  return <main className="studio">
    <header className="topbar"><div className="brand"><span className="brand-mark">JR</span><div><strong>JRadio</strong><small>UNIVERSAL BROADCAST ENCODER</small></div></div><span className="status"><i className={mixReady ? "active" : ""} /> {broadcasting ? "ON AIR" : mixReady ? "AUDIO MIX READY" : "NOT BROADCASTING"}</span></header>
    <section className="welcome"><p className="eyebrow">BROADCAST CONTROL ROOM</p><h1>Your sound. <span>Your station.</span></h1><p className="intro">Capture supported audio sources, mix them into one programme feed, then send that feed to your radio server.</p></section>
    <section className="panel"><div className="section-heading"><div><p className="eyebrow">INPUTS</p><h2>Audio channels</h2></div><span className="muted">Live capture controls</span></div>
      <div className="audio-sources">
        {(["microphone", "desktop", "device"] as const).map((id, index) => <article className="audio-source" key={id}>
          <div className="channel-number">0{index + 1}</div>
          <div className="source-main"><div className="source-title"><strong>{sourceNames[id]}</strong><span className={active[id] ? "source-badge connected" : "source-badge"}>{active[id] ? "CONNECTED" : "IDLE"}</span></div>
            <div className="meter" aria-label={`Audio level ${Math.round(levels[id] * 100)} percent`}>{meterBars(levels[id])}</div>
            <div className="source-controls"><label>Volume <input type="range" min="0" max="100" value={Math.round(volumes[id] * 100)} disabled={!active[id]} onChange={e => changeVolume(id, Number(e.target.value))}/><span>{Math.round(volumes[id] * 100)}%</span></label>
              {id === "device" && <div className="device-picker"><select value={selectedDeviceId} onChange={e => setSelectedDeviceId(e.target.value)} disabled={active.device || audioBusy}><option value="">Select an audio input…</option>{inputDevices.map(device => <option value={device.deviceId} key={device.deviceId}>{device.label}</option>)}</select><button className="small-button" disabled={audioBusy || active.device} onClick={() => void refreshInputDevices()}>REFRESH DEVICES</button></div>}
              {active[id] ? <><button className="small-button" onClick={() => toggleMute(id)}>{muted[id] ? "UNMUTE" : "MUTE"}</button><button className="small-button stop" onClick={() => stopSource(id)}>STOP</button></> : <button className="small-button capture" disabled={audioBusy || (id === "device" && !selectedDeviceId)} onClick={() => void capture(id)}>{id === "microphone" ? "CAPTURE MIC" : id === "device" ? "CONNECT DEVICE" : "CAPTURE DESKTOP AUDIO"}</button>}
            </div>
          </div>
        </article>)}
      </div>
      <p className="field-help audio-note">Choose a physical soundcard, USB audio interface, line input or virtual cable (such as VB-CABLE on Windows) in the device channel. Route the other application playback output to that virtual device. Desktop sharing remains available where supported. Device names may appear only after microphone permission is granted.</p>
      <div className="audio-actions"><button className="validate-button" disabled={!mixReady} onClick={() => { try { const stream = engine().getBroadcastStream(); setAudioMessage(`Programme mix is ready (${stream.getAudioTracks().length} audio track). Ready for the selected streaming output.`); } catch (error) { setAudioMessage(error instanceof Error ? error.message : "Mix unavailable."); } }}>CHECK PROGRAMME MIX</button><button className="small-button stop-all" disabled={!mixReady && !audioBusy} onClick={() => void stopAllAudio()}>STOP ALL AUDIO</button></div>
      <p className="audio-message" role="status">{audioMessage}</p>
    </section>
    <section className="panel connection-panel"><div className="section-heading"><div><p className="eyebrow">STATION OUTPUT</p><h2>Streaming server profile</h2></div><span className="muted">Icecast live source adapter / other protocols in development</span></div>
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
        <label className="full-width">Source password<input type="password" value={profile.sourcePassword} onChange={e=>update("sourcePassword",e.target.value)} placeholder="Enter source password" autoComplete="new-password"/><small className="field-help">Stored only when you choose Save Securely; the desktop app encrypts the profile with your device's secure storage. It is never sent to a server.</small></label>
      </div>
      <div className="validation-area"><button type="button" className="validate-button" onClick={()=>setValidationRequested(true)}>VALIDATE PROFILE</button><button type="button" className="validate-button" onClick={saveProfile} disabled={storageBusy}>SAVE SECURELY</button><button type="button" className="validate-button" onClick={loadProfile} disabled={storageBusy}>LOAD SAVED PROFILE</button>{validationRequested&&<div className={validation.valid?"validation-success":"validation-errors"}>{validation.valid?"Profile fields look valid. This does not test a server connection.":<ul>{validation.errors.map(error=><li key={error}>{error}</li>)}</ul>}</div>}{storageMessage&&<p className="field-help" role="status">{storageMessage}</p>}</div>
    </section>
    <section className="lower-grid"><article className="panel"><p className="eyebrow">MASTER BUS</p><h2>Programme output</h2><div className="master-meter"><span style={{ width: `${Math.round(masterLevel * 100)}%` }}/></div><div className="master-value">{Math.round(masterLevel * 100)}% signal</div><div className="master-controls"><label>Master volume <input type="range" min="0" max="100" value={Math.round(masterVolume * 100)} onChange={e => changeMasterVolume(Number(e.target.value))}/></label><button className="small-button" onClick={toggleMasterMute}>{masterMuted ? "UNMUTE MASTER" : "MUTE MASTER"}</button></div><p className="muted">The programme mix combines active input channels into one audio stream.</p></article><article className="panel master"><p className="eyebrow">BROADCAST STATUS</p><h2>{broadcasting ? "Broadcast is live" : "Ready to broadcast"}</h2><div className="placeholder">{broadcasting ? "Your programme mix is being encoded by FFmpeg and sent to the Icecast source." : "Connect a source, complete the server profile and start the Icecast broadcast. FFmpeg must be installed and available on PATH."}</div>{broadcasting ? <button type="button" className="live-stop" disabled={audioBusy} onClick={() => void stopBroadcast()}>STOP BROADCAST</button> : <button type="button" disabled={!mixReady || audioBusy} onClick={() => void startBroadcast()}>START ICECAST BROADCAST</button>}</article></section>
    <footer>JRadio Universal Broadcast Encoder <span>Free and open-source project · Development build</span></footer>
  </main>;
}
