#ifndef PLATFORMOGL_H
#define PLATFORMOGL_H

// If you don't wanna use glad for your platform,
// define MELONDS_GL_HEADER to the path of some other header
// that pulls in the necessary OpenGL declarations.
// Make sure to include quotes or angle brackets as needed,
// and that all targets get the same MELONDS_GL_HEADER definition.

#ifndef MELONDS_GL_HEADER
#define MELONDS_GL_HEADER "\"frontend/glad/glad.h\""
#endif

#ifndef DISABLE_OPENGL_INCLUDES
#ifdef MELONDS_EMSCRIPTEN_GLES
// If we are compiling using Emscripten, we need to use OpenGL ES 3.0
#include <GLES3/gl3.h>
#include <GLES2/gl2ext.h>
#include <GLES3/gl3platform.h>

// Note: wasmelon does not currently support OpenGL due to compatibility
// issues, since melonDS is requiring OpenGL 3.1 and we will need to
// port it to work correctly.
#else
#include MELONDS_GL_HEADER
#endif
#endif

#endif
