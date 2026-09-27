#!/usr/bin/env python3
"""اختبار/تشغيل خادم dev ك daemon بانفصال مزدوج — الحفيد يتيم بجلسة جديدة"""
import os, sys, time, subprocess

def daemonize(cmd, cwd, logfile):
    pid = os.fork()
    if pid == 0:
        os.setsid()
        pid2 = os.fork()
        if pid2 == 0:
            # الحفيد — PPID يصبح 1 (tini) وجلسة جديدة
            os.chdir(cwd)
            os.umask(0o022)
            with open(logfile, "a") as lf:
                subprocess.Popen(cmd, stdout=lf, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, cwd=cwd)
            time.sleep(2)
            os._exit(0)
        else:
            os._exit(0)
    else:
        os.waitpid(pid, 0)

if __name__ == "__main__":
    if sys.argv[1] == "test":
        daemonize(["sleep", "300"], "/tmp", "/dev/null")
        print("sleep daemon spawned")
    elif sys.argv[1] == "dev":
        # أوقف أي خادم سابق
        subprocess.run(["pkill", "-f", "next dev"], capture_output=True)
        subprocess.run(["pkill", "-f", "next-server"], capture_output=True)
        time.sleep(1)
        daemonize(["bun", "run", "dev"], "/home/z/my-project", "/home/z/my-project/dev.log")
        print("dev server daemon spawned")
