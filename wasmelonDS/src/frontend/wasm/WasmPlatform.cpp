#include <emscripten/emscripten.h>

#include <thread>
#include <semaphore>
#include <mutex>

#include "frontend/wasm/WasmPlatformUtil.h"
#include "frontend/wasm/WasmEmulator.h"

#include "Platform.h"

namespace melonDS::Platform {

  // For files, we are going to simply use the filesystem that Emscripten provides for
  // compatibility. We will eventually make Emscripten use IndexedDB for storage so
  // we can actually do things like save states, save files, persistent locally stored
  // ROM files, persistent firmware, etc.

  // Note: FileHandle* = FILE * for now

  void SignalStop(StopReason reason, void* userdata) {
    // TODO: implement this.
    Log(LogLevel::Error, "Stopped with signal %d", reason);
    ((wasmelon::WasmEmulator*)userdata)->handleShutdown();
  }

  std::string GetLocalFilePath(const std::string& filename) {
    return filename;
  }

  FileHandle* OpenFile(const std::string& path, FileMode mode) {
    return (FileHandle*)fopen(path.c_str(), wasmelon::get_file_mode_str(
      mode, wasmelon::does_file_exist(path)
    ).c_str());
  }

  FileHandle* OpenLocalFile(const std::string& path, FileMode mode) {
    return OpenFile(path, mode);
  }

  bool FileExists(const std::string &name) {
    return wasmelon::does_file_exist(name);
  }

  bool LocalFileExists(const std::string &name) {
    return FileExists(name);
  }

  bool CheckFileWritable(const std::string &name) {
    if (FILE *f = fopen(name.c_str(), "w")) {
      fclose(f);
      return true;
    }
    return false;
  }

  bool CheckLocalFileWriteable(const std::string &name) {
    return CheckFileWritable(name);
  }

  bool CloseFile(FileHandle* file) {
    return fclose((FILE *)file);
  }

  bool IsEndOfFile(FileHandle* file) {
    return feof((FILE *)file);
  }

  bool FileReadLine(char* str, int count, FileHandle* file) {
    return fgets(str, count, (FILE *) file);
  }

  bool FileSeek(FileHandle* file, s64 offset, FileSeekOrigin origin) {
    // We assume FileSeekOrigin matches up with SEEK_SET, SEEK_CUR, SEEK_END.
    return fseek((FILE *)file, offset, (int)origin);
  }

  void FileRewind(FileHandle *file) {
    rewind((FILE *)file); 
  }

  u64 FileRead(void* data, u64 size, u64 count, FileHandle* file) {
    return fread(data, size, count, (FILE *)file);
  }
  
  bool FileFlush(FileHandle *file) {
    return fflush((FILE *) file);
  }

  u64 FileWrite(const void* data, u64 size, u64 count, FileHandle* file) {
    return fwrite(data, size, count, (FILE *)file);
  }

  u64 FileWriteFormatted(FileHandle* file, const char* fmt, ...) {
    if (fmt == nullptr) return 0;

    va_list args;
    va_start(args, fmt);
    u64 ret = vfprintf((FILE *)file, fmt, args);
    va_end(args);
    return ret;
  }

  u64 FileLength(FileHandle* file) {
    fseek((FILE *)file, 0L, SEEK_END);
    u64 file_size = ftell((FILE *)file);
    fseek((FILE *)file, 0L, SEEK_SET);
    return file_size;
  }

  void Log(LogLevel level, const char* fmt, ...) {
    if (fmt == nullptr) return;

    va_list args;
    va_start(args, fmt);
    vprintf(fmt, args);
    va_end(args);
  }

  // Using std library concurrency which relies on pthread
  // This might become an issue due to how pthread works in WASM.

  Thread* Thread_Create(std::function<void()> func) {
    std::thread *t = new std::thread(func);
    return (Thread*)t;
  }

  void Thread_Free(Thread* thread) {
    delete (std::thread *)thread;
  }

  void Thread_Wait(Thread* thread) {
    ((std::thread *)thread)->join();
  }

  // Not sure what we should actually set the max of the sempahore to be,
  // so I'm using this so we can change it later if necessary.
  using wasmelon_semaphore = std::counting_semaphore<0xfffffffL>;

  Semaphore* Semaphore_Create() {
    return (Semaphore*)new wasmelon_semaphore(0);
  }

  void Semaphore_Free(Semaphore* sema) {
    delete (wasmelon_semaphore*) sema;
  }

  void Semaphore_Reset(Semaphore* sema) {
    // There's probably a better way to do this...
    while (!((wasmelon_semaphore *)sema)->try_acquire_for(std::chrono::milliseconds(0))) {
      ((wasmelon_semaphore *)sema)->acquire();
    }
  }

  void Semaphore_Wait(Semaphore* sema) {
    ((wasmelon_semaphore *)sema)->acquire();
  }

  bool Semaphore_TryWait(Semaphore* sema, int timeout_ms) {
    return ((wasmelon_semaphore *)sema)->try_acquire_for(std::chrono::milliseconds(timeout_ms));
  }

  void Semaphore_Post(Semaphore* sema, int count) {
    ((wasmelon_semaphore *)sema)->release(count);
  }

  Mutex* Mutex_Create() {
    return (Mutex*) new std::mutex();
  }

  void Mutex_Free(Mutex* mutex) {
    delete (std::mutex*) mutex;
  }

  void Mutex_Lock(Mutex* mutex) {
    ((std::mutex*) mutex)->lock();
  }

  void Mutex_Unlock(Mutex* mutex) {
    ((std::mutex*) mutex)->unlock();
  }

  bool Mutex_TryLock(Mutex* mutex) {
    return ((std::mutex*) mutex)->try_lock();
  }

  void Sleep(u64 secs) {
    // TODO: check if this is okay
    emscripten_sleep(static_cast<unsigned int>(secs * 1000));
  }

  u64 GetMSCount() {
    return static_cast<u64>(emscripten_get_now());
  }

  u64 GetUSCount() {
    // I'm pretty sure nothing actually uses this, which is good because
    // there's not a great API to get this from within webassembly
    return 0;
  }

  // For now, these are all stubs. We will likely implement these later.
  
  // Writing saves, firmware, time
  void WriteNDSSave(const u8* savedata, u32 savelen, u32 writeoffset, u32 writelen, void* userdata) { 
    // I'm going to ignore writeoffset/writelen for now. If it causes performance issues or data
    // corruption, we can maybe consider using them then.
    Platform::Log(Platform::LogLevel::Debug, "userdata ptr == %x\n", userdata);
    ((wasmelon::WasmEmulator*)userdata)->writeSave(savedata, savelen);
  }
  void WriteGBASave(const u8* savedata, u32 savelen, u32 writeoffset, u32 writelen, void* userdata) { }
  void WriteFirmware(const Firmware& firmware, u32 writeoffset, u32 writelen, void* userdata) { }
  void WriteDateTime(int year, int month, int day, int hour, int minute, int second, void* userdata) { }

  // Local Multiplayer (DS Download Play)
  void MP_Begin(void* userdata) { }
  void MP_End(void* userdata) { }
  int MP_SendPacket(u8* data, int len, u64 timestamp, void* userdata) { }
  int MP_RecvPacket(u8* data, u64* timestamp, void* userdata) { }
  int MP_SendCmd(u8* data, int len, u64 timestamp, void* userdata) { }
  int MP_SendReply(u8* data, int len, u64 timestamp, u16 aid, void* userdata) { }
  int MP_SendAck(u8* data, int len, u64 timestamp, void* userdata) { }
  int MP_RecvHostPacket(u8* data, u64* timestamp, void* userdata) { }
  u16 MP_RecvReplies(u8* data, u64 timestamp, u16 aidmask, void* userdata) { }

  // NetPlay interface (going to likely remain unimplemented)
  int Net_SendPacket(u8* data, int len, void* userdata) { }
  int Net_RecvPacket(u8* data, void* userdata) { }

  // DSi Camera: May or may not be implemented, depends on if we add DSi support
  void Camera_Start(int num, void* userdata) { }
  void Camera_Stop(int num, void* userdata) { }
  void Camera_CaptureFrame(int num, u32* frame, int width, int height, bool yuv, void* userdata) { }

  // Addons: The DS Rumble Pak allows "rumble" features, we will use this to vibrate the controller
  // or device when possible
  void Addon_RumbleStart(u32 len, void* userdata) {
    ((wasmelon::WasmEmulator*)userdata)->startRumble();
  }
  void Addon_RumbleStop(void* userdata) {
    ((wasmelon::WasmEmulator*)userdata)->stopRumble();
  }

  DynamicLibrary* DynamicLibrary_Load(const char* lib) {
    return nullptr;
  }
  void DynamicLibrary_Unload(DynamicLibrary* lib) {}
  void* DynamicLibrary_LoadFunction(DynamicLibrary* lib, const char* name) {}
}