export class PlaybackGuard {
 private playing=false;private sessions=new Set<string>();
 start(session:string|undefined,automatic:boolean):boolean {if(this.playing || (automatic && (!session || this.sessions.has(session))))return false;this.playing=true;if(session)this.sessions.add(session);return true;}
 stop():void {this.playing=false;}
}
