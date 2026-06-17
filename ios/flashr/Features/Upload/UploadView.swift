import SwiftUI

struct UploadView: View {
    var body: some View {
        ZStack {
            Color.flashrBg.ignoresSafeArea()
            Text("Upload")
                .font(.flashrH1)
                .foregroundStyle(Color.flashrText)
        }
        .navigationTitle("Upload")
    }
}
