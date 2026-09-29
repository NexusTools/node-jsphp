export class OutputBufferStack {
  private buffers: string[] = [];

  public start(): boolean {
    this.buffers.push("");
    return true;
  }

  public write(data: string): void {
    if (this.buffers.length > 0) {
      this.buffers[this.buffers.length - 1] += data;
    }
  }

  public getClean(): string {
    if (this.buffers.length === 0) return "";
    return this.buffers.pop() || "";
  }

  public getContents(): string {
    if (this.buffers.length === 0) return "";
    return this.buffers[this.buffers.length - 1];
  }

  public flush(): boolean {
    if (this.buffers.length === 0) return false;
    const content = this.buffers.pop() || "";
    if (this.buffers.length > 0) {
      this.buffers[this.buffers.length - 1] += content;
    }
    return true;
  }

  public endClean(): boolean {
    if (this.buffers.length === 0) return false;
    this.buffers.pop();
    return true;
  }

  public getLevel(): number {
    return this.buffers.length;
  }

  public isActive(): boolean {
    return this.buffers.length > 0;
  }
}
