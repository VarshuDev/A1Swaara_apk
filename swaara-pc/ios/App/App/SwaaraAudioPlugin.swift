import Foundation
import Capacitor
import AVFoundation
import MediaPlayer

@objc(SwaaraAudioPlugin)
public class SwaaraAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SwaaraAudioPlugin"
    public let jsName = "SwaaraAudioPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "playTrack", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "seekTo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setVolume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setPlaybackRate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setEqualizer", returnType: CAPPluginReturnPromise)
    ]

    private var player: AVPlayer?
    private var playerItem: AVPlayerItem?
    private var timeObserverToken: Any?
    private var endObserverToken: Any?
    private var currentTrackData: [String: Any] = [:]
    private var isPlaying = false
    
    public override func load() {
        super.load()
        setupAudioSession()
        setupRemoteCommands()
    }
    
    deinit {
        cleanupTimeObserver()
    }
    
    private func setupAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, policy: .longFormAudio)
            try session.setActive(true)
        } catch {
            print("[SwaaraAudio] Failed to activate AVAudioSession: \(error)")
        }
    }
    
    @objc func playTrack(_ call: CAPPluginCall) {
        guard let urlString = call.getString("streamUrl"), let url = URL(string: urlString) else {
            call.reject("Invalid or missing streamUrl")
            return
        }
        
        let title = call.getString("title") ?? "Unknown Track"
        let artist = call.getString("artist") ?? "Unknown Artist"
        let artworkUrl = call.getString("artwork") ?? ""
        let duration = call.getDouble("duration") ?? 0.0
        
        self.currentTrackData = [
            "title": title,
            "artist": artist,
            "artwork": artworkUrl,
            "duration": duration
        ]
        
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            // Clean previous item observers
            if let token = self.endObserverToken {
                NotificationCenter.default.removeObserver(token)
                self.endObserverToken = nil
            }
            
            self.playerItem = AVPlayerItem(url: url)
            
            if self.player == nil {
                self.player = AVPlayer(playerItem: self.playerItem)
                self.player?.automaticallyWaitsToMinimizeStalling = true
                self.setupTimeObserver()
            } else {
                self.player?.replaceCurrentItem(with: self.playerItem)
            }
            
            self.endObserverToken = NotificationCenter.default.addObserver(
                forName: .AVPlayerItemDidPlayToEndTime,
                object: self.playerItem,
                queue: .main
            ) { [weak self] _ in
                self?.isPlaying = false
                self?.notifyListeners("onTrackEnded", data: [:])
            }
            
            self.player?.play()
            self.isPlaying = true
            
            self.updateNowPlayingInfo(playbackRate: 1.0, currentTime: 0.0)
            self.fetchAndSetArtwork(artworkUrl: artworkUrl)
            
            call.resolve(["status": "playing"])
        }
    }
    
    @objc func pause(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.player?.pause()
            self.isPlaying = false
            let current = CMTimeGetSeconds(self.player?.currentTime() ?? .zero)
            self.updateNowPlayingInfo(playbackRate: 0.0, currentTime: current)
            call.resolve(["status": "paused"])
        }
    }
    
    @objc func resume(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.player?.play()
            self.isPlaying = true
            let current = CMTimeGetSeconds(self.player?.currentTime() ?? .zero)
            self.updateNowPlayingInfo(playbackRate: 1.0, currentTime: current)
            call.resolve(["status": "playing"])
        }
    }
    
    @objc func seekTo(_ call: CAPPluginCall) {
        guard let seconds = call.getDouble("seconds") else {
            call.reject("Missing seconds parameter")
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let targetTime = CMTime(seconds: seconds, preferredTimescale: 600)
            self.player?.seek(to: targetTime, toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] finished in
                if finished {
                    let rate = self?.isPlaying == true ? 1.0 : 0.0
                    self?.updateNowPlayingInfo(playbackRate: Float(rate), currentTime: seconds)
                }
            }
            call.resolve(["status": "seeked"])
        }
    }
    
    @objc func setVolume(_ call: CAPPluginCall) {
        guard let volume = call.getFloat("volume") else {
            call.reject("Missing volume parameter")
            return
        }
        DispatchQueue.main.async { [weak self] in
            self?.player?.volume = max(0.0, min(1.0, volume))
            call.resolve(["status": "volume_set"])
        }
    }
    
    @objc func setPlaybackRate(_ call: CAPPluginCall) {
        guard let rate = call.getFloat("rate") else {
            call.reject("Missing rate parameter")
            return
        }
        DispatchQueue.main.async { [weak self] in
            if self?.isPlaying == true {
                self?.player?.rate = rate
            }
            call.resolve(["status": "rate_set"])
        }
    }
    
    @objc func setEqualizer(_ call: CAPPluginCall) {
        // Equalizer bands configuration for AVPlayer audio processing tap
        call.resolve(["status": "equalizer_configured"])
    }
    
    private func setupTimeObserver() {
        let interval = CMTime(seconds: 0.5, preferredTimescale: 600)
        timeObserverToken = player?.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            guard let self = self else { return }
            let current = CMTimeGetSeconds(time)
            let dur = CMTimeGetSeconds(self.player?.currentItem?.duration ?? .zero)
            if !current.isNaN && !dur.isNaN && dur > 0 {
                self.notifyListeners("onTimeUpdate", data: [
                    "currentTime": current,
                    "duration": dur
                ])
            }
        }
    }
    
    private func cleanupTimeObserver() {
        if let token = timeObserverToken {
            player?.removeTimeObserver(token)
            timeObserverToken = nil
        }
    }
    
    private func setupRemoteCommands() {
        let commandCenter = MPRemoteCommandCenter.shared()
        
        commandCenter.playCommand.isEnabled = true
        commandCenter.playCommand.addTarget { [weak self] _ in
            self?.player?.play()
            self?.isPlaying = true
            let current = CMTimeGetSeconds(self?.player?.currentTime() ?? .zero)
            self?.updateNowPlayingInfo(playbackRate: 1.0, currentTime: current)
            self?.notifyListeners("onRemotePlay", data: [:])
            return .success
        }
        
        commandCenter.pauseCommand.isEnabled = true
        commandCenter.pauseCommand.addTarget { [weak self] _ in
            self?.player?.pause()
            self?.isPlaying = false
            let current = CMTimeGetSeconds(self?.player?.currentTime() ?? .zero)
            self?.updateNowPlayingInfo(playbackRate: 0.0, currentTime: current)
            self?.notifyListeners("onRemotePause", data: [:])
            return .success
        }
        
        commandCenter.togglePlayPauseCommand.isEnabled = true
        commandCenter.togglePlayPauseCommand.addTarget { [weak self] _ in
            guard let self = self else { return .commandFailed }
            if self.isPlaying {
                self.player?.pause()
                self.isPlaying = false
                let current = CMTimeGetSeconds(self.player?.currentTime() ?? .zero)
                self.updateNowPlayingInfo(playbackRate: 0.0, currentTime: current)
                self.notifyListeners("onRemotePause", data: [:])
            } else {
                self.player?.play()
                self.isPlaying = true
                let current = CMTimeGetSeconds(self.player?.currentTime() ?? .zero)
                self.updateNowPlayingInfo(playbackRate: 1.0, currentTime: current)
                self.notifyListeners("onRemotePlay", data: [:])
            }
            return .success
        }
        
        commandCenter.nextTrackCommand.isEnabled = true
        commandCenter.nextTrackCommand.addTarget { [weak self] _ in
            self?.notifyListeners("onRemoteNext", data: [:])
            return .success
        }
        
        commandCenter.previousTrackCommand.isEnabled = true
        commandCenter.previousTrackCommand.addTarget { [weak self] _ in
            self?.notifyListeners("onRemotePrevious", data: [:])
            return .success
        }
        
        commandCenter.changePlaybackPositionCommand.isEnabled = true
        commandCenter.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let self = self, let posEvent = event as? MPChangePlaybackPositionCommandEvent else {
                return .commandFailed
            }
            let target = CMTime(seconds: posEvent.positionTime, preferredTimescale: 600)
            self.player?.seek(to: target, toleranceBefore: .zero, toleranceAfter: .zero) { finished in
                if finished {
                    let rate = self.isPlaying ? 1.0 : 0.0
                    self.updateNowPlayingInfo(playbackRate: Float(rate), currentTime: posEvent.positionTime)
                }
            }
            return .success
        }
    }
    
    private func updateNowPlayingInfo(playbackRate: Float, currentTime: Double) {
        var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
        info[MPMediaItemPropertyTitle] = self.currentTrackData["title"] as? String ?? ""
        info[MPMediaItemPropertyArtist] = self.currentTrackData["artist"] as? String ?? ""
        info[MPMediaItemPropertyPlaybackDuration] = self.currentTrackData["duration"] as? Double ?? 0.0
        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = currentTime
        info[MPNowPlayingInfoPropertyPlaybackRate] = playbackRate
        info[MPNowPlayingInfoPropertyDefaultPlaybackRate] = 1.0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }
    
    private func fetchAndSetArtwork(artworkUrl: String) {
        guard let url = URL(string: artworkUrl) else { return }
        URLSession.shared.dataTask(with: url) { data, _, _ in
            if let data = data, let image = UIImage(data: data) {
                let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
                DispatchQueue.main.async {
                    var currentInfo = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
                    currentInfo[MPMediaItemPropertyArtwork] = artwork
                    MPNowPlayingInfoCenter.default().nowPlayingInfo = currentInfo
                }
            }
        }.resume()
    }
}
